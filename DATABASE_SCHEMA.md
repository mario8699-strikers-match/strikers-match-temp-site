# Strikers Match Studio Database Schema

## Schema Status

This document defines the Version 1 PostgreSQL database schema specification.

No migrations are created by this document.

No schema may be implemented or modified without approval.

## Database

PostgreSQL.

## Schema Scope

Included:

- Events
- Fighters
- Sponsors
- Fight Cards
- Bouts
- Camera Sources
- Production Sessions
- Round Timer
- Assets
- Graphics Cues
- Recording
- Reusable RTMP Destination Profiles
- Event Destination Links
- Stream Outputs

Excluded:

- AI features
- Replay
- Slow Motion
- Scorecards
- Judges
- Rankings
- Fighter Statistics Engine
- Mobile App
- Automated Highlights
- Automated Clipping
- Social Content Generation
- OAuth integrations
- Platform-specific APIs

## Tables

### events

Stores event records.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | Yes | Primary key |
| name | text | Yes | Event name |
| venue_name | text | No | Venue name |
| starts_at | timestamptz | No | Scheduled start time |
| status | text | Yes | Event status |
| event_logo_asset_id | uuid | No | References assets.id |
| event_banner_asset_id | uuid | No | References assets.id |
| created_at | timestamptz | Yes | Creation timestamp |
| updated_at | timestamptz | Yes | Last update timestamp |

### fighters

Stores fighter records.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | Yes | Primary key |
| first_name | text | Yes | Fighter first name |
| last_name | text | Yes | Fighter last name |
| nickname | text | No | Fighter nickname |
| hometown | text | No | Fighter hometown |
| country | text | No | Fighter country |
| stance | text | No | Fighter stance |
| fighter_headshot_asset_id | uuid | No | References assets.id |
| created_at | timestamptz | Yes | Creation timestamp |
| updated_at | timestamptz | Yes | Last update timestamp |

### sponsors

Stores sponsor records.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | Yes | Primary key |
| name | text | Yes | Sponsor name |
| sponsor_logo_asset_id | uuid | No | References assets.id |
| website_url | text | No | Sponsor website URL |
| created_at | timestamptz | Yes | Creation timestamp |
| updated_at | timestamptz | Yes | Last update timestamp |

### fight_cards

Stores fight cards for events.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | Yes | Primary key |
| event_id | uuid | Yes | References events.id |
| name | text | Yes | Fight card name |
| created_at | timestamptz | Yes | Creation timestamp |
| updated_at | timestamptz | Yes | Last update timestamp |

### bouts

Stores bouts assigned to fight cards.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | Yes | Primary key |
| fight_card_id | uuid | Yes | References fight_cards.id |
| red_fighter_id | uuid | Yes | References fighters.id |
| blue_fighter_id | uuid | Yes | References fighters.id |
| weight_class | text | No | Bout weight class |
| scheduled_rounds | integer | Yes | Scheduled round count |
| round_duration_seconds | integer | Yes | Round duration in seconds |
| sort_order | integer | Yes | Fight card order |
| created_at | timestamptz | Yes | Creation timestamp |
| updated_at | timestamptz | Yes | Last update timestamp |

### camera_sources

Stores browser camera sources for events.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | Yes | Primary key |
| event_id | uuid | Yes | References events.id |
| role_name | text | Yes | Camera role name |
| source_index | integer | Yes | Camera number, 1 through 6 |
| ingest_url | text | No | WebRTC ingest URL |
| status | text | Yes | Camera source status |
| device_label | text | No | Browser-provided device label when available |
| connected_at | timestamptz | No | Connection timestamp |
| disconnected_at | timestamptz | No | Disconnection timestamp |
| created_at | timestamptz | Yes | Creation timestamp |
| updated_at | timestamptz | Yes | Last update timestamp |

Default source indexes and role names:

1. Ring Wide
2. Ring Tight
3. Walkout
4. Crowd
5. Interview
6. Backup

Role names may be renamed per event.

### production_sessions

Stores production session state.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | Yes | Primary key |
| event_id | uuid | Yes | References events.id |
| status | text | Yes | Production session status |
| preview_camera_source_id | uuid | No | References camera_sources.id |
| program_camera_source_id | uuid | No | References camera_sources.id |
| active_bout_id | uuid | No | References bouts.id |
| went_live_at | timestamptz | No | Go Live timestamp |
| ended_at | timestamptz | No | End Stream timestamp |
| created_at | timestamptz | Yes | Creation timestamp |
| updated_at | timestamptz | Yes | Last update timestamp |

Production session switching must use Preview / Program with Take.

Direct-to-program switching is not allowed.

### round_timers

Stores round timer state.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | Yes | Primary key |
| production_session_id | uuid | Yes | References production_sessions.id |
| current_round | integer | Yes | Current round number |
| duration_seconds | integer | Yes | Round duration in seconds |
| remaining_seconds | integer | Yes | Remaining seconds |
| status | text | Yes | Timer status |
| started_at | timestamptz | No | Timer start timestamp |
| paused_at | timestamptz | No | Timer pause timestamp |
| created_at | timestamptz | Yes | Creation timestamp |
| updated_at | timestamptz | Yes | Last update timestamp |

### assets

Stores asset metadata for DigitalOcean Spaces objects.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | Yes | Primary key |
| asset_type | text | Yes | Event Logo, Event Banner, Fighter Headshot, or Sponsor Logo |
| storage_bucket | text | Yes | DigitalOcean Spaces bucket |
| storage_key | text | Yes | DigitalOcean Spaces object key |
| content_type | text | No | MIME type |
| file_size_bytes | bigint | No | Asset size |
| created_at | timestamptz | Yes | Creation timestamp |
| updated_at | timestamptz | Yes | Last update timestamp |

Allowed asset types:

- Event Logo
- Event Banner
- Fighter Headshot
- Sponsor Logo

No other asset types are allowed.

### event_sponsors

Associates sponsors with events.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | Yes | Primary key |
| event_id | uuid | Yes | References events.id |
| sponsor_id | uuid | Yes | References sponsors.id |
| sort_order | integer | Yes | Display order |
| created_at | timestamptz | Yes | Creation timestamp |
| updated_at | timestamptz | Yes | Last update timestamp |

### graphics_cues

Stores graphics cues for events.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | Yes | Primary key |
| event_id | uuid | Yes | References events.id |
| cue_type | text | Yes | Event Branding, Fighter Intro Graphics, Matchup Graphics, or Sponsor Overlays |
| name | text | Yes | Cue name |
| payload | jsonb | Yes | Cue configuration |
| is_active | boolean | Yes | Active cue flag |
| created_at | timestamptz | Yes | Creation timestamp |
| updated_at | timestamptz | Yes | Last update timestamp |

### destination_profiles

Stores reusable RTMP destination profiles.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | Yes | Primary key |
| name | text | Yes | Destination profile name |
| platform | text | Yes | YouTube, Facebook, Instagram, TikTok, or Custom RTMP |
| rtmp_url | text | Yes | RTMP URL |
| stream_key_secret_ref | text | Yes | Reference to stored stream key secret |
| status | text | Yes | Destination profile status |
| created_at | timestamptz | Yes | Creation timestamp |
| updated_at | timestamptz | Yes | Last update timestamp |

Only RTMP destination profiles are allowed.

No OAuth integrations are allowed.

No platform-specific APIs are allowed.

### event_destination_profiles

Links reusable destination profiles to events.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | Yes | Primary key |
| event_id | uuid | Yes | References events.id |
| destination_profile_id | uuid | Yes | References destination_profiles.id |
| is_enabled | boolean | Yes | Enabled for event flag |
| created_at | timestamptz | Yes | Creation timestamp |
| updated_at | timestamptz | Yes | Last update timestamp |

### recordings

Stores MP4 recording records.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | Yes | Primary key |
| event_id | uuid | Yes | References events.id |
| production_session_id | uuid | Yes | References production_sessions.id |
| status | text | Yes | Recording status |
| format | text | Yes | MP4 |
| storage_bucket | text | No | DigitalOcean Spaces bucket |
| storage_key | text | No | DigitalOcean Spaces object key |
| started_at | timestamptz | No | Recording start timestamp |
| finalized_at | timestamptz | No | Recording finalized timestamp |
| created_at | timestamptz | Yes | Creation timestamp |
| updated_at | timestamptz | Yes | Last update timestamp |

Recording starts automatically when Go Live is pressed.

Recording cannot be disabled.

Recording format must be MP4.

Finalized recordings must link to the event.

### stream_outputs

Stores active and historical RTMP stream output records.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | Yes | Primary key |
| production_session_id | uuid | Yes | References production_sessions.id |
| event_destination_profile_id | uuid | Yes | References event_destination_profiles.id |
| status | text | Yes | Stream output status |
| started_at | timestamptz | No | Stream start timestamp |
| ended_at | timestamptz | No | Stream end timestamp |
| created_at | timestamptz | Yes | Creation timestamp |
| updated_at | timestamptz | Yes | Last update timestamp |

## Constraints

- camera_sources.source_index must be between 1 and 6.
- Each event may have no more than 6 camera sources.
- Default camera source role names are Ring Wide, Ring Tight, Walkout, Crowd, Interview, and Backup.
- Camera role names may be renamed per event.
- Direct-to-program switching is not allowed.
- bouts.scheduled_rounds must be greater than 0.
- bouts.round_duration_seconds must be greater than 0.
- round_timers.current_round must be greater than 0.
- round_timers.duration_seconds must be greater than 0.
- round_timers.remaining_seconds must be greater than or equal to 0.
- assets.asset_type must be one of: Event Logo, Event Banner, Fighter Headshot, Sponsor Logo.
- destination_profiles.platform must be one of: YouTube, Facebook, Instagram, TikTok, Custom RTMP.
- recordings.format must be MP4.
- Recording cannot be disabled.

## Foreign Keys

- events.event_logo_asset_id references assets.id
- events.event_banner_asset_id references assets.id
- fighters.fighter_headshot_asset_id references assets.id
- sponsors.sponsor_logo_asset_id references assets.id
- fight_cards.event_id references events.id
- bouts.fight_card_id references fight_cards.id
- bouts.red_fighter_id references fighters.id
- bouts.blue_fighter_id references fighters.id
- camera_sources.event_id references events.id
- production_sessions.event_id references events.id
- production_sessions.preview_camera_source_id references camera_sources.id
- production_sessions.program_camera_source_id references camera_sources.id
- production_sessions.active_bout_id references bouts.id
- round_timers.production_session_id references production_sessions.id
- event_sponsors.event_id references events.id
- event_sponsors.sponsor_id references sponsors.id
- graphics_cues.event_id references events.id
- event_destination_profiles.event_id references events.id
- event_destination_profiles.destination_profile_id references destination_profiles.id
- recordings.event_id references events.id
- recordings.production_session_id references production_sessions.id
- stream_outputs.production_session_id references production_sessions.id
- stream_outputs.event_destination_profile_id references event_destination_profiles.id

## Indexes

- events.status
- events.starts_at
- fight_cards.event_id
- bouts.fight_card_id
- bouts.sort_order
- camera_sources.event_id
- camera_sources.event_id, camera_sources.source_index
- production_sessions.event_id
- round_timers.production_session_id
- event_sponsors.event_id
- graphics_cues.event_id
- destination_profiles.platform
- destination_profiles.status
- event_destination_profiles.event_id
- event_destination_profiles.destination_profile_id
- recordings.event_id
- recordings.production_session_id
- stream_outputs.production_session_id
- stream_outputs.event_destination_profile_id

## Approval Requirement

This schema must be approved before implementation.
