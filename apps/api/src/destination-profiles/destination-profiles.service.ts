import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import { POSTGRES_POOL_PROVIDER } from "../database/postgres.provider";

const ALLOWED_PLATFORMS = [
  "YouTube",
  "Facebook",
  "Instagram",
  "TikTok",
  "Custom RTMP",
] as const;

type AllowedPlatform = (typeof ALLOWED_PLATFORMS)[number];

export type DestinationProfile = {
  id: string;
  name: string;
  platform: AllowedPlatform;
  rtmp_url: string;
  stream_key_secret_ref: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type EventDestinationProfile = {
  id: string;
  event_id: string;
  destination_profile_id: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateDestinationProfileInput = {
  name: string;
  platform: string;
  rtmpUrl: string;
  streamKeySecretRef: string;
  status?: string;
};

@Injectable()
export class DestinationProfilesService {
  constructor(
    @Inject(POSTGRES_POOL_PROVIDER)
    private readonly pool: Pool,
  ) {}

  async listDestinationProfiles(): Promise<DestinationProfile[]> {
    const result = await this.pool.query<DestinationProfile>(
      `
      select
        id,
        name,
        platform,
        rtmp_url,
        stream_key_secret_ref,
        status,
        created_at,
        updated_at
      from destination_profiles
      order by name asc
      `,
    );

    return result.rows;
  }

  async createDestinationProfile(
    input: CreateDestinationProfileInput,
  ): Promise<DestinationProfile> {
    const platform = this.assertPlatform(input.platform);
    const name = input.name.trim();
    const rtmpUrl = input.rtmpUrl.trim();
    const streamKeySecretRef = input.streamKeySecretRef.trim();
    const status = input.status?.trim() || "active";

    if (!name) throw new BadRequestException("Destination name is required.");
    if (!rtmpUrl) throw new BadRequestException("RTMP URL is required.");
    if (!streamKeySecretRef) {
      throw new BadRequestException("Stream key secret reference is required.");
    }

    const result = await this.pool.query<DestinationProfile>(
      `
      insert into destination_profiles (
        id,
        name,
        platform,
        rtmp_url,
        stream_key_secret_ref,
        status,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, now(), now())
      returning
        id,
        name,
        platform,
        rtmp_url,
        stream_key_secret_ref,
        status,
        created_at,
        updated_at
      `,
      [randomUUID(), name, platform, rtmpUrl, streamKeySecretRef, status],
    );

    return result.rows[0];
  }

  async linkDestinationToEvent(
    eventId: string,
    destinationProfileId: string,
    isEnabled: boolean,
  ): Promise<EventDestinationProfile> {
    const result = await this.pool.query<EventDestinationProfile>(
      `
      insert into event_destination_profiles (
        id,
        event_id,
        destination_profile_id,
        is_enabled,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, now(), now())
      returning
        id,
        event_id,
        destination_profile_id,
        is_enabled,
        created_at,
        updated_at
      `,
      [randomUUID(), eventId, destinationProfileId, isEnabled],
    );

    return result.rows[0];
  }

  async setEventDestinationEnabled(
    eventDestinationProfileId: string,
    isEnabled: boolean,
  ): Promise<EventDestinationProfile> {
    const result = await this.pool.query<EventDestinationProfile>(
      `
      update event_destination_profiles
      set is_enabled = $2,
          updated_at = now()
      where id = $1
      returning
        id,
        event_id,
        destination_profile_id,
        is_enabled,
        created_at,
        updated_at
      `,
      [eventDestinationProfileId, isEnabled],
    );

    const link = result.rows[0];
    if (!link) throw new BadRequestException("Event destination link not found.");
    return link;
  }

  private assertPlatform(platform: string): AllowedPlatform {
    const match = ALLOWED_PLATFORMS.find((item) => item === platform);
    if (!match) throw new BadRequestException("Unsupported destination platform.");
    return match;
  }
}
