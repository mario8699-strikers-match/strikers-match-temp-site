import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import { POSTGRES_POOL_PROVIDER } from "../database/postgres.provider";
import { EventsService } from "../events/events.service";

const ALLOWED_CUE_TYPES = [
  "Event Branding",
  "Fighter Intro Graphics",
  "Matchup Graphics",
  "Sponsor Overlays",
] as const;

type AllowedCueType = (typeof ALLOWED_CUE_TYPES)[number];

export type GraphicsCue = {
  id: string;
  event_id: string;
  cue_type: AllowedCueType;
  name: string;
  payload: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateGraphicsCueInput = {
  cueType: string;
  name: string;
  payload: unknown;
  isActive?: boolean;
};

@Injectable()
export class GraphicsCuesService {
  constructor(
    @Inject(POSTGRES_POOL_PROVIDER)
    private readonly pool: Pool,
    private readonly eventsService: EventsService,
  ) {}

  async listGraphicsCuesForEvent(eventId: string): Promise<GraphicsCue[]> {
    await this.eventsService.getEvent(eventId);

    const result = await this.pool.query<GraphicsCue>(
      `
      select
        id,
        event_id,
        cue_type,
        name,
        payload,
        is_active,
        created_at,
        updated_at
      from graphics_cues
      where event_id = $1
      order by cue_type asc, name asc
      `,
      [eventId],
    );

    return result.rows;
  }

  async createGraphicsCue(
    eventId: string,
    input: CreateGraphicsCueInput,
  ): Promise<GraphicsCue> {
    await this.eventsService.getEvent(eventId);

    const cueType = this.assertCueType(input.cueType);
    const name = input.name.trim();
    const payload = this.assertPayload(input.payload);

    if (!name) throw new BadRequestException("Graphics cue name is required.");

    const result = await this.pool.query<GraphicsCue>(
      `
      insert into graphics_cues (
        id,
        event_id,
        cue_type,
        name,
        payload,
        is_active,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, now(), now())
      returning
        id,
        event_id,
        cue_type,
        name,
        payload,
        is_active,
        created_at,
        updated_at
      `,
      [randomUUID(), eventId, cueType, name, payload, input.isActive ?? false],
    );

    return result.rows[0];
  }

  async setGraphicsCueActive(
    graphicsCueId: string,
    isActive: boolean,
  ): Promise<GraphicsCue> {
    const result = await this.pool.query<GraphicsCue>(
      `
      update graphics_cues
      set is_active = $2,
          updated_at = now()
      where id = $1
      returning
        id,
        event_id,
        cue_type,
        name,
        payload,
        is_active,
        created_at,
        updated_at
      `,
      [graphicsCueId, isActive],
    );

    const cue = result.rows[0];
    if (!cue) throw new BadRequestException("Graphics cue not found.");
    return cue;
  }

  private assertCueType(cueType: string): AllowedCueType {
    const match = ALLOWED_CUE_TYPES.find((item) => item === cueType);
    if (!match) throw new BadRequestException("Unsupported graphics cue type.");
    return match;
  }

  private assertPayload(payload: unknown): Record<string, unknown> {
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      throw new BadRequestException("Graphics cue payload must be a JSON object.");
    }

    return payload as Record<string, unknown>;
  }
}
