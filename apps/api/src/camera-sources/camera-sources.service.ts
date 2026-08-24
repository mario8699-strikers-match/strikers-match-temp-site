import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import { POSTGRES_POOL_PROVIDER } from "../database/postgres.provider";

const DEFAULT_CAMERA_ROLES = [
  "Ring Wide",
  "Ring Tight",
  "Walkout",
  "Crowd",
  "Interview",
  "Backup",
] as const;

export type CameraSource = {
  id: string;
  event_id: string;
  role_name: string;
  source_index: number;
  ingest_url: string | null;
  status: string;
  device_label: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class CameraSourcesService {
  constructor(
    @Inject(POSTGRES_POOL_PROVIDER)
    private readonly pool: Pool,
  ) {}

  async listCameraSourcesForEvent(eventId: string): Promise<CameraSource[]> {
    const result = await this.pool.query<CameraSource>(
      `
      select
        id,
        event_id,
        role_name,
        source_index,
        ingest_url,
        status,
        device_label,
        connected_at,
        disconnected_at,
        created_at,
        updated_at
      from camera_sources
      where event_id = $1
      order by source_index asc
      `,
      [eventId],
    );

    return result.rows;
  }

  async ensureDefaultCameraSources(eventId: string): Promise<CameraSource[]> {
    const existing = await this.listCameraSourcesForEvent(eventId);
    const existingIndexes = new Set(existing.map((source) => source.source_index));

    for (let index = 1; index <= DEFAULT_CAMERA_ROLES.length; index += 1) {
      if (existingIndexes.has(index)) continue;

      await this.pool.query(
        `
        insert into camera_sources (
          id,
          event_id,
          role_name,
          source_index,
          status,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, 'disconnected', now(), now())
        `,
        [randomUUID(), eventId, DEFAULT_CAMERA_ROLES[index - 1], index],
      );
    }

    return this.listCameraSourcesForEvent(eventId);
  }
}
