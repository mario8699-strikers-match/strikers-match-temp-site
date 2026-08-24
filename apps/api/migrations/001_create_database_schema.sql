BEGIN;

CREATE SCHEMA IF NOT EXISTS studio;

SET search_path TO studio;

CREATE TABLE assets (
  id uuid PRIMARY KEY,
  asset_type text NOT NULL,
  storage_bucket text NOT NULL,
  storage_key text NOT NULL,
  content_type text,
  file_size_bytes bigint,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT assets_asset_type_check CHECK (
    asset_type IN (
      'Event Logo',
      'Event Banner',
      'Fighter Headshot',
      'Sponsor Logo'
    )
  )
);

CREATE TABLE events (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  venue_name text,
  starts_at timestamptz,
  status text NOT NULL,
  event_logo_asset_id uuid,
  event_banner_asset_id uuid,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE fighters (
  id uuid PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  nickname text,
  hometown text,
  country text,
  stance text,
  fighter_headshot_asset_id uuid,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE sponsors (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  sponsor_logo_asset_id uuid,
  website_url text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE fight_cards (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE bouts (
  id uuid PRIMARY KEY,
  fight_card_id uuid NOT NULL,
  red_fighter_id uuid NOT NULL,
  blue_fighter_id uuid NOT NULL,
  weight_class text,
  scheduled_rounds integer NOT NULL,
  round_duration_seconds integer NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT bouts_scheduled_rounds_check CHECK (scheduled_rounds > 0),
  CONSTRAINT bouts_round_duration_seconds_check CHECK (round_duration_seconds > 0)
);

CREATE TABLE camera_sources (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  role_name text NOT NULL,
  source_index integer NOT NULL,
  ingest_url text,
  status text NOT NULL,
  device_label text,
  connected_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT camera_sources_source_index_check CHECK (
    source_index BETWEEN 1 AND 6
  ),
  CONSTRAINT camera_sources_event_id_source_index_unique UNIQUE (
    event_id,
    source_index
  )
);

CREATE TABLE production_sessions (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  status text NOT NULL,
  preview_camera_source_id uuid,
  program_camera_source_id uuid,
  active_bout_id uuid,
  went_live_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE round_timers (
  id uuid PRIMARY KEY,
  production_session_id uuid NOT NULL,
  current_round integer NOT NULL,
  duration_seconds integer NOT NULL,
  remaining_seconds integer NOT NULL,
  status text NOT NULL,
  started_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT round_timers_current_round_check CHECK (current_round > 0),
  CONSTRAINT round_timers_duration_seconds_check CHECK (duration_seconds > 0),
  CONSTRAINT round_timers_remaining_seconds_check CHECK (remaining_seconds >= 0)
);

CREATE TABLE event_sponsors (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  sponsor_id uuid NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE graphics_cues (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  cue_type text NOT NULL,
  name text NOT NULL,
  payload jsonb NOT NULL,
  is_active boolean NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE destination_profiles (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  platform text NOT NULL,
  rtmp_url text NOT NULL,
  stream_key_secret_ref text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT destination_profiles_platform_check CHECK (
    platform IN (
      'YouTube',
      'Facebook',
      'Instagram',
      'TikTok',
      'Custom RTMP'
    )
  )
);

CREATE TABLE event_destination_profiles (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  destination_profile_id uuid NOT NULL,
  is_enabled boolean NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE recordings (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  production_session_id uuid NOT NULL,
  status text NOT NULL,
  format text NOT NULL,
  storage_bucket text,
  storage_key text,
  started_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT recordings_format_check CHECK (format = 'MP4')
);

CREATE TABLE stream_outputs (
  id uuid PRIMARY KEY,
  production_session_id uuid NOT NULL,
  event_destination_profile_id uuid NOT NULL,
  status text NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

ALTER TABLE events
  ADD CONSTRAINT events_event_logo_asset_id_fkey
    FOREIGN KEY (event_logo_asset_id) REFERENCES assets(id),
  ADD CONSTRAINT events_event_banner_asset_id_fkey
    FOREIGN KEY (event_banner_asset_id) REFERENCES assets(id);

ALTER TABLE fighters
  ADD CONSTRAINT fighters_fighter_headshot_asset_id_fkey
    FOREIGN KEY (fighter_headshot_asset_id) REFERENCES assets(id);

ALTER TABLE sponsors
  ADD CONSTRAINT sponsors_sponsor_logo_asset_id_fkey
    FOREIGN KEY (sponsor_logo_asset_id) REFERENCES assets(id);

ALTER TABLE fight_cards
  ADD CONSTRAINT fight_cards_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES events(id);

ALTER TABLE bouts
  ADD CONSTRAINT bouts_fight_card_id_fkey
    FOREIGN KEY (fight_card_id) REFERENCES fight_cards(id),
  ADD CONSTRAINT bouts_red_fighter_id_fkey
    FOREIGN KEY (red_fighter_id) REFERENCES fighters(id),
  ADD CONSTRAINT bouts_blue_fighter_id_fkey
    FOREIGN KEY (blue_fighter_id) REFERENCES fighters(id);

ALTER TABLE camera_sources
  ADD CONSTRAINT camera_sources_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES events(id);

ALTER TABLE production_sessions
  ADD CONSTRAINT production_sessions_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES events(id),
  ADD CONSTRAINT production_sessions_preview_camera_source_id_fkey
    FOREIGN KEY (preview_camera_source_id) REFERENCES camera_sources(id),
  ADD CONSTRAINT production_sessions_program_camera_source_id_fkey
    FOREIGN KEY (program_camera_source_id) REFERENCES camera_sources(id),
  ADD CONSTRAINT production_sessions_active_bout_id_fkey
    FOREIGN KEY (active_bout_id) REFERENCES bouts(id);

ALTER TABLE round_timers
  ADD CONSTRAINT round_timers_production_session_id_fkey
    FOREIGN KEY (production_session_id) REFERENCES production_sessions(id);

ALTER TABLE event_sponsors
  ADD CONSTRAINT event_sponsors_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES events(id),
  ADD CONSTRAINT event_sponsors_sponsor_id_fkey
    FOREIGN KEY (sponsor_id) REFERENCES sponsors(id);

ALTER TABLE graphics_cues
  ADD CONSTRAINT graphics_cues_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES events(id);

ALTER TABLE event_destination_profiles
  ADD CONSTRAINT event_destination_profiles_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES events(id),
  ADD CONSTRAINT event_destination_profiles_destination_profile_id_fkey
    FOREIGN KEY (destination_profile_id) REFERENCES destination_profiles(id);

ALTER TABLE recordings
  ADD CONSTRAINT recordings_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES events(id),
  ADD CONSTRAINT recordings_production_session_id_fkey
    FOREIGN KEY (production_session_id) REFERENCES production_sessions(id);

ALTER TABLE stream_outputs
  ADD CONSTRAINT stream_outputs_production_session_id_fkey
    FOREIGN KEY (production_session_id) REFERENCES production_sessions(id),
  ADD CONSTRAINT stream_outputs_event_destination_profile_id_fkey
    FOREIGN KEY (event_destination_profile_id) REFERENCES event_destination_profiles(id);

CREATE INDEX events_status_idx ON events (status);
CREATE INDEX events_starts_at_idx ON events (starts_at);
CREATE INDEX fight_cards_event_id_idx ON fight_cards (event_id);
CREATE INDEX bouts_fight_card_id_idx ON bouts (fight_card_id);
CREATE INDEX bouts_sort_order_idx ON bouts (sort_order);
CREATE INDEX camera_sources_event_id_idx ON camera_sources (event_id);
CREATE INDEX camera_sources_event_id_source_index_idx
  ON camera_sources (event_id, source_index);
CREATE INDEX production_sessions_event_id_idx ON production_sessions (event_id);
CREATE INDEX round_timers_production_session_id_idx
  ON round_timers (production_session_id);
CREATE INDEX event_sponsors_event_id_idx ON event_sponsors (event_id);
CREATE INDEX graphics_cues_event_id_idx ON graphics_cues (event_id);
CREATE INDEX destination_profiles_platform_idx ON destination_profiles (platform);
CREATE INDEX destination_profiles_status_idx ON destination_profiles (status);
CREATE INDEX event_destination_profiles_event_id_idx
  ON event_destination_profiles (event_id);
CREATE INDEX event_destination_profiles_destination_profile_id_idx
  ON event_destination_profiles (destination_profile_id);
CREATE INDEX recordings_event_id_idx ON recordings (event_id);
CREATE INDEX recordings_production_session_id_idx
  ON recordings (production_session_id);
CREATE INDEX stream_outputs_production_session_id_idx
  ON stream_outputs (production_session_id);
CREATE INDEX stream_outputs_event_destination_profile_id_idx
  ON stream_outputs (event_destination_profile_id);

COMMIT;
