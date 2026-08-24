import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { POSTGRES_POOL_PROVIDER } from "../database/postgres.provider";

export type StudioEvent = {
  id: string;
  name: string;
  venue_name: string | null;
  starts_at: string | null;
  status: string;
  event_logo_asset_id: string | null;
  event_banner_asset_id: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class EventsService {
  constructor(
    @Inject(POSTGRES_POOL_PROVIDER)
    private readonly pool: Pool,
  ) {}

  async listEvents(): Promise<StudioEvent[]> {
    const result = await this.pool.query<StudioEvent>(
      `
      select
        id,
        event_name as name,
        venue as venue_name,
        event_date::timestamptz as starts_at,
        status,
        null::uuid as event_logo_asset_id,
        null::uuid as event_banner_asset_id,
        created_at,
        created_at as updated_at
      from public.events
      order by event_date nulls last, created_at desc
      `,
    );

    await Promise.all(result.rows.map((event) => this.syncStudioEventShell(event)));
    return result.rows;
  }

  async getEvent(eventId: string): Promise<StudioEvent> {
    const result = await this.pool.query<StudioEvent>(
      `
      select
        id,
        event_name as name,
        venue as venue_name,
        event_date::timestamptz as starts_at,
        status,
        null::uuid as event_logo_asset_id,
        null::uuid as event_banner_asset_id,
        created_at,
        created_at as updated_at
      from public.events
      where id = $1
      `,
      [eventId],
    );

    const event = result.rows[0];
    if (!event) throw new NotFoundException("Event not found.");
    await this.syncStudioEventShell(event);
    return event;
  }

  private async syncStudioEventShell(event: StudioEvent): Promise<void> {
    await this.pool.query(
      `
      insert into events (
        id,
        name,
        venue_name,
        starts_at,
        status,
        event_logo_asset_id,
        event_banner_asset_id,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, null, null, $6, now())
      on conflict (id) do update
      set name = excluded.name,
          venue_name = excluded.venue_name,
          starts_at = excluded.starts_at,
          status = excluded.status,
          updated_at = now()
      `,
      [
        event.id,
        event.name,
        event.venue_name,
        event.starts_at,
        event.status,
        event.created_at,
      ],
    );
  }
}
