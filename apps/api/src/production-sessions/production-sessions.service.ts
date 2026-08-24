import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { Pool, PoolClient } from "pg";
import { CameraSourcesService } from "../camera-sources/camera-sources.service";
import { POSTGRES_POOL_PROVIDER } from "../database/postgres.provider";
import { EventsService } from "../events/events.service";
import { FightCardsService } from "../fight-cards/fight-cards.service";
import { GraphicsCuesService } from "../graphics-cues/graphics-cues.service";
import {
  DestinationProfileSummary,
  ProductionSession,
  Recording,
  RoundTimer,
  StudioState,
} from "./production-session.types";

@Injectable()
export class ProductionSessionsService {
  constructor(
    @Inject(POSTGRES_POOL_PROVIDER)
    private readonly pool: Pool,
    private readonly eventsService: EventsService,
    private readonly fightCardsService: FightCardsService,
    private readonly cameraSourcesService: CameraSourcesService,
    private readonly graphicsCuesService: GraphicsCuesService,
  ) {}

  async getStudioState(eventId: string): Promise<StudioState> {
    const event = await this.eventsService.getEvent(eventId);
    const [
      fightCards,
      cameraSources,
      productionSession,
      destinationProfiles,
      graphicsCues,
    ] =
      await Promise.all([
        this.fightCardsService.listFightCardsForEvent(eventId),
        this.cameraSourcesService.listCameraSourcesForEvent(eventId),
        this.getCurrentProductionSession(eventId),
        this.listDestinationProfilesForEvent(eventId),
        this.graphicsCuesService.listGraphicsCuesForEvent(eventId),
      ]);

    const [roundTimer, recording] = productionSession
      ? await Promise.all([
          this.getRoundTimerForSession(productionSession.id),
          this.getLatestRecordingForSession(productionSession.id),
        ])
      : [null, null];

    return {
      event,
      fightCards,
      cameraSources,
      productionSession,
      roundTimer,
      recording,
      destinationProfiles,
      graphicsCues,
    };
  }

  async createProductionSession(eventId: string): Promise<ProductionSession> {
    await this.eventsService.getEvent(eventId);
    await this.cameraSourcesService.ensureDefaultCameraSources(eventId);

    const existing = await this.getCurrentProductionSession(eventId);
    if (existing) return existing;

    const result = await this.pool.query<ProductionSession>(
      `
      insert into production_sessions (
        id,
        event_id,
        status,
        created_at,
        updated_at
      )
      values ($1, $2, 'setup', now(), now())
      returning
        id,
        event_id,
        status,
        preview_camera_source_id,
        program_camera_source_id,
        active_bout_id,
        went_live_at,
        ended_at,
        created_at,
        updated_at
      `,
      [randomUUID(), eventId],
    );

    return result.rows[0];
  }

  async selectPreviewCamera(
    sessionId: string,
    cameraSourceId: string | null,
  ): Promise<ProductionSession> {
    const session = await this.getProductionSession(sessionId);

    if (cameraSourceId) {
      const cameraResult = await this.pool.query(
        `
        select id
        from camera_sources
        where id = $1 and event_id = $2
        `,
        [cameraSourceId, session.event_id],
      );

      if (cameraResult.rowCount !== 1) {
        throw new BadRequestException("Camera source does not belong to this production session event.");
      }
    }

    const result = await this.pool.query<ProductionSession>(
      `
      update production_sessions
      set preview_camera_source_id = $2,
          updated_at = now()
      where id = $1
      returning
        id,
        event_id,
        status,
        preview_camera_source_id,
        program_camera_source_id,
        active_bout_id,
        went_live_at,
        ended_at,
        created_at,
        updated_at
      `,
      [sessionId, cameraSourceId],
    );

    return result.rows[0];
  }

  async takePreviewToProgram(sessionId: string): Promise<ProductionSession> {
    const client = await this.pool.connect();

    try {
      await client.query("begin");
      const session = await this.getProductionSessionForUpdate(client, sessionId);

      if (!session.preview_camera_source_id) {
        throw new BadRequestException("Select a preview camera before taking program.");
      }

      const result = await client.query<ProductionSession>(
        `
        update production_sessions
        set program_camera_source_id = preview_camera_source_id,
            preview_camera_source_id = null,
            updated_at = now()
        where id = $1
        returning
          id,
          event_id,
          status,
          preview_camera_source_id,
          program_camera_source_id,
          active_bout_id,
          went_live_at,
          ended_at,
          created_at,
          updated_at
        `,
        [sessionId],
      );

      await client.query("commit");
      return result.rows[0];
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async setActiveBout(
    sessionId: string,
    boutId: string | null,
  ): Promise<ProductionSession> {
    const session = await this.getProductionSession(sessionId);

    if (boutId) {
      const boutResult = await this.pool.query(
        `
        select id
        from public.bouts
        where id = $1 and event_id = $2
        `,
        [boutId, session.event_id],
      );

      if (boutResult.rowCount !== 1) {
        throw new BadRequestException("Bout does not belong to this production session event.");
      }
    }

    const result = await this.pool.query<ProductionSession>(
      `
      update production_sessions
      set active_bout_id = $2,
          updated_at = now()
      where id = $1
      returning
        id,
        event_id,
        status,
        preview_camera_source_id,
        program_camera_source_id,
        active_bout_id,
        went_live_at,
        ended_at,
        created_at,
        updated_at
      `,
      [sessionId, boutId],
    );

    return result.rows[0];
  }

  async configureRoundTimer(
    sessionId: string,
    currentRound: number,
    durationSeconds: number,
  ): Promise<RoundTimer> {
    if (currentRound < 1) throw new BadRequestException("Round must be greater than 0.");
    if (durationSeconds < 1) {
      throw new BadRequestException("Round duration must be greater than 0.");
    }

    await this.getProductionSession(sessionId);
    const existing = await this.getRoundTimerForSession(sessionId);

    if (existing) {
      const result = await this.pool.query<RoundTimer>(
        `
        update round_timers
        set current_round = $2,
            duration_seconds = $3,
            remaining_seconds = $3,
            status = 'ready',
            started_at = null,
            paused_at = null,
            updated_at = now()
        where id = $1
        returning
          id,
          production_session_id,
          current_round,
          duration_seconds,
          remaining_seconds,
          status,
          started_at,
          paused_at,
          created_at,
          updated_at
        `,
        [existing.id, currentRound, durationSeconds],
      );

      return result.rows[0];
    }

    const result = await this.pool.query<RoundTimer>(
      `
      insert into round_timers (
        id,
        production_session_id,
        current_round,
        duration_seconds,
        remaining_seconds,
        status,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, $4, 'ready', now(), now())
      returning
        id,
        production_session_id,
        current_round,
        duration_seconds,
        remaining_seconds,
        status,
        started_at,
        paused_at,
        created_at,
        updated_at
      `,
      [randomUUID(), sessionId, currentRound, durationSeconds],
    );

    return result.rows[0];
  }

  async startRoundTimer(sessionId: string): Promise<RoundTimer> {
    const timer = await this.getRequiredRoundTimerForSession(sessionId);
    if (timer.remaining_seconds <= 0) {
      throw new BadRequestException("Round timer has no remaining time.");
    }

    const result = await this.pool.query<RoundTimer>(
      `
      update round_timers
      set status = 'running',
          started_at = now(),
          paused_at = null,
          updated_at = now()
      where id = $1
      returning
        id,
        production_session_id,
        current_round,
        duration_seconds,
        remaining_seconds,
        status,
        started_at,
        paused_at,
        created_at,
        updated_at
      `,
      [timer.id],
    );

    return result.rows[0];
  }

  async pauseRoundTimer(sessionId: string): Promise<RoundTimer> {
    const timer = await this.getRequiredRoundTimerForSession(sessionId);
    const remainingSeconds = this.calculateRemainingSeconds(timer);

    const result = await this.pool.query<RoundTimer>(
      `
      update round_timers
      set status = 'paused',
          remaining_seconds = $2,
          started_at = null,
          paused_at = now(),
          updated_at = now()
      where id = $1
      returning
        id,
        production_session_id,
        current_round,
        duration_seconds,
        remaining_seconds,
        status,
        started_at,
        paused_at,
        created_at,
        updated_at
      `,
      [timer.id, remainingSeconds],
    );

    return result.rows[0];
  }

  async resetRoundTimer(sessionId: string): Promise<RoundTimer> {
    const timer = await this.getRequiredRoundTimerForSession(sessionId);

    const result = await this.pool.query<RoundTimer>(
      `
      update round_timers
      set status = 'ready',
          remaining_seconds = duration_seconds,
          started_at = null,
          paused_at = null,
          updated_at = now()
      where id = $1
      returning
        id,
        production_session_id,
        current_round,
        duration_seconds,
        remaining_seconds,
        status,
        started_at,
        paused_at,
        created_at,
        updated_at
      `,
      [timer.id],
    );

    return result.rows[0];
  }

  private async getCurrentProductionSession(
    eventId: string,
  ): Promise<ProductionSession | null> {
    const result = await this.pool.query<ProductionSession>(
      `
      select
        id,
        event_id,
        status,
        preview_camera_source_id,
        program_camera_source_id,
        active_bout_id,
        went_live_at,
        ended_at,
        created_at,
        updated_at
      from production_sessions
      where event_id = $1 and ended_at is null
      order by created_at desc
      limit 1
      `,
      [eventId],
    );

    return result.rows[0] ?? null;
  }

  private async getProductionSession(sessionId: string): Promise<ProductionSession> {
    const result = await this.pool.query<ProductionSession>(
      `
      select
        id,
        event_id,
        status,
        preview_camera_source_id,
        program_camera_source_id,
        active_bout_id,
        went_live_at,
        ended_at,
        created_at,
        updated_at
      from production_sessions
      where id = $1
      `,
      [sessionId],
    );

    const session = result.rows[0];
    if (!session) throw new NotFoundException("Production session not found.");
    return session;
  }

  private async getProductionSessionForUpdate(
    client: PoolClient,
    sessionId: string,
  ): Promise<ProductionSession> {
    const result = await client.query<ProductionSession>(
      `
      select
        id,
        event_id,
        status,
        preview_camera_source_id,
        program_camera_source_id,
        active_bout_id,
        went_live_at,
        ended_at,
        created_at,
        updated_at
      from production_sessions
      where id = $1
      for update
      `,
      [sessionId],
    );

    const session = result.rows[0];
    if (!session) throw new NotFoundException("Production session not found.");
    return session;
  }

  private async getRoundTimerForSession(sessionId: string): Promise<RoundTimer | null> {
    const result = await this.pool.query<RoundTimer>(
      `
      select
        id,
        production_session_id,
        current_round,
        duration_seconds,
        remaining_seconds,
        status,
        started_at,
        paused_at,
        created_at,
        updated_at
      from round_timers
      where production_session_id = $1
      order by created_at desc
      limit 1
      `,
      [sessionId],
    );

    const timer = result.rows[0];
    if (!timer) return null;

    return {
      ...timer,
      remaining_seconds: this.calculateRemainingSeconds(timer),
      status: timer.status === "running" && this.calculateRemainingSeconds(timer) === 0
        ? "complete"
        : timer.status,
    };
  }

  private async getRequiredRoundTimerForSession(
    sessionId: string,
  ): Promise<RoundTimer> {
    await this.getProductionSession(sessionId);
    const timer = await this.getRoundTimerForSession(sessionId);
    if (!timer) throw new BadRequestException("Round timer is not configured.");
    return timer;
  }

  private calculateRemainingSeconds(timer: RoundTimer): number {
    if (timer.status !== "running" || !timer.started_at) {
      return timer.remaining_seconds;
    }

    const elapsedSeconds = Math.floor(
      (Date.now() - new Date(timer.started_at).getTime()) / 1000,
    );

    return Math.max(0, timer.remaining_seconds - elapsedSeconds);
  }

  private async getLatestRecordingForSession(sessionId: string): Promise<Recording | null> {
    const result = await this.pool.query<Recording>(
      `
      select
        id,
        event_id,
        production_session_id,
        status,
        format,
        storage_bucket,
        storage_key,
        started_at,
        finalized_at,
        created_at,
        updated_at
      from recordings
      where production_session_id = $1
      order by created_at desc
      limit 1
      `,
      [sessionId],
    );

    return result.rows[0] ?? null;
  }

  private async listDestinationProfilesForEvent(
    eventId: string,
  ): Promise<DestinationProfileSummary[]> {
    const result = await this.pool.query<DestinationProfileSummary>(
      `
      select
        destination_profiles.id,
        event_destination_profiles.id as event_destination_profile_id,
        destination_profiles.name,
        destination_profiles.platform,
        destination_profiles.status,
        event_destination_profiles.is_enabled
      from event_destination_profiles
      join destination_profiles
        on destination_profiles.id = event_destination_profiles.destination_profile_id
      where event_destination_profiles.event_id = $1
      order by destination_profiles.name asc
      `,
      [eventId],
    );

    return result.rows;
  }
}
