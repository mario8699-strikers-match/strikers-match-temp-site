# Strikers Match Studio Progress

## Source documents

This implementation follows:

- `PROJECT_STRUCTURE.md`
- `PRODUCT_REQUIREMENTS.md`
- `ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `DEVELOPMENT_RULES.md`

## Current implementation status

### Completed

- Verified the existing Studio structure before adding files.
- Confirmed these approved module directories did not already exist before creation:
  - `apps/api/src/events`
  - `apps/api/src/fight-cards`
  - `apps/api/src/camera-sources`
  - `apps/api/src/production-sessions`
- Added database-backed NestJS modules for:
  - events
  - fight cards
  - camera sources
  - production sessions
- Added API endpoints for:
  - listing Studio events
  - loading a Studio event
  - loading event fight cards and bouts
  - loading event camera sources
  - loading full Studio production state
  - creating/loading a production session
  - selecting a Preview camera
  - taking Preview to Program
  - setting the active bout for a production session
  - configuring the round timer
  - starting the round timer
  - pausing the round timer
  - resetting the round timer
  - listing reusable RTMP destination profiles
  - creating reusable RTMP destination profiles
  - linking RTMP destination profiles to an event
  - enabling and disabling event destination profiles
  - listing event graphics cues
  - creating event graphics cues
  - activating and deactivating event graphics cues
- Enforced the required Preview / Program workflow:
  - operators select a camera into Preview first
  - `Take` moves Preview into Program
  - no direct-to-program endpoint was created
- Added automatic creation of the six approved browser camera source slots when a production session is started:
  1. Ring Wide
  2. Ring Tight
  3. Walkout
  4. Crowd
  5. Interview
  6. Backup
- Enabled CORS on the NestJS API so the Studio web app can call it.
- Replaced the basic Studio web home page with an API-backed dark control-room interface.
- Added mobile-responsive Studio panels for:
  - event selector
  - Preview monitor
  - Program monitor
  - session state
  - recording state display
  - destination count display
  - round timer state display
  - round timer controls
  - local browser camera preview
  - local browser recording and download
  - camera source controls
  - fight card display
  - active bout selection
  - event destination profile controls
  - reusable RTMP destination profile controls
  - graphics cue controls
- Added a no-server local capture phase:
  - camera access happens through the operator's browser
  - recording happens in the browser with `MediaRecorder`
  - completed recordings are downloaded to the operator's device
  - no recording is uploaded to Strikers Match servers in this phase
- Added the Studio UI to the real Strikers Match event route:
  - `/events/[id]/manage/streaming`
  - admin-aware event shell
  - local camera preview
  - local device recording/download
  - active bout selection from existing public event bouts
  - round timer
  - basic Preview to Output control
  - graphics preview
- Added multistream destination setup UI for:
  - Facebook Live
  - Instagram Live
  - TikTok Live
  - YouTube Live
  - Custom RTMP
- Multistream destinations are currently configuration/demo only:
  - no real stream keys should be entered in the UI
  - key reference fields are placeholders for future secure backend secret storage
  - all destinations are marked pending until SRS/FFmpeg server infrastructure exists
- Added event camera-slot workflow UI for:
  - Ring wide
  - Ring tight
  - Crowd
  - Walkout
  - Dressing rooms
  - Hallway
- Camera-slot workflow is currently configuration/demo only:
  - each slot has an operator field
  - each slot can generate a temporary access code
  - each slot can copy an operator invitation
  - each slot can be marked waiting or connected for demo
  - local browser camera can be assigned to a slot for preview/output demonstration
  - real remote camera ingest still requires SRS/WebRTC server infrastructure
- Camera access codes such as `SM-RINGWIDE-H6KQC9` are currently placeholders:
  - they do not connect a real remote camera yet
  - they identify the intended event camera slot during the demo
  - they should become one-time camera tokens in a future implementation
  - they should be delivered through a share link or QR code, not typed manually in normal operation
  - camera operators must not share one admin/promoter account
- Added a disabled Server Streaming panel that clearly marks these features as deferred:
  - remote multi-camera ingest
  - public livestream
  - RTMP output to platforms
  - server-side program output
  - server-side recording
- No mock data was added.
- No new dependencies were added.
- No files were created outside the approved Studio structure except this progress file requested by the user.
- Studio database tables were applied to the existing upgraded Supabase PostgreSQL database under the isolated `studio` schema.
- Studio API database config now falls back to existing Supabase env values:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_DB_PASSWORD`
- The API database connection uses `search_path=studio` so it does not query or modify the existing `public` app tables.
- Graphics cue state is included in the full Studio state response to avoid an extra frontend request when loading the control room.
- Studio now uses the existing Strikers Match event engine as the source of truth:
  - events are read from `public.events`
  - fight card rows are generated from `public.bouts`
  - Studio-only production state remains isolated in the `studio` schema
  - `studio.production_sessions.active_bout_id` now references `public.bouts`
- Studio still maintains a synchronized event shell in `studio.events` with the same event ID only to satisfy Studio-owned foreign keys for camera sources, production sessions, destinations, graphics cues, recordings, and sponsors.

## Camera access-code workflow note

The current Studio UI can generate demo access codes for camera slots, for example:

```text
SM-RINGWIDE-H6KQC9
```

Current meaning:

- This is a demo access code for the selected event camera slot.
- It does not open a functional remote camera connection yet.
- It helps explain how multiple devices will be assigned to roles such as Ring Wide, Crowd, Dressing Rooms, or Hallway.

Intended future workflow:

```text
Producer opens Studio
  -> selects a camera slot
  -> generates one-time access token
  -> system creates camera join link / QR code
  -> camera operator opens link on phone
  -> operator allows camera and microphone
  -> phone connects to the assigned camera slot
  -> producer sees status change to Connected
  -> producer controls Preview and Output
```

Future camera join link example:

```text
https://strikersmatch.com/camera/join/SM-RINGWIDE-H6KQC9
```

or:

```text
https://strikersmatch.com/events/{eventId}/camera/ring-wide?code=SM-RINGWIDE-H6KQC9
```

The operator should not need admin access. Access options should be:

1. Operator logs in with their own Strikers Match account and uses the camera link.
2. Operator uses a short-lived one-time event camera link with limited permissions.

The code/token should eventually support:

- event scoping
- camera-slot scoping
- expiration
- single-use or limited-use status
- revoke/regenerate controls
- status values such as unused, waiting, connected, expired, and revoked
- audit trail for which device/operator connected
- server-side validation before WebRTC ingest starts

Required future implementation:

- camera join page
- one-time camera token table/API
- token expiration and revocation
- QR/link generation
- WebRTC ingest connection to SRS
- producer-side connected-camera status from the media server
- no shared admin login for camera operators

## Files created

### API

- `apps/api/src/events/events.module.ts`
- `apps/api/src/events/events.controller.ts`
- `apps/api/src/events/events.service.ts`
- `apps/api/src/fight-cards/fight-cards.module.ts`
- `apps/api/src/fight-cards/fight-cards.controller.ts`
- `apps/api/src/fight-cards/fight-cards.service.ts`
- `apps/api/src/camera-sources/camera-sources.module.ts`
- `apps/api/src/camera-sources/camera-sources.controller.ts`
- `apps/api/src/camera-sources/camera-sources.service.ts`
- `apps/api/src/destination-profiles/destination-profiles.module.ts`
- `apps/api/src/destination-profiles/destination-profiles.controller.ts`
- `apps/api/src/destination-profiles/destination-profiles.service.ts`
- `apps/api/src/graphics-cues/graphics-cues.module.ts`
- `apps/api/src/graphics-cues/graphics-cues.controller.ts`
- `apps/api/src/graphics-cues/graphics-cues.service.ts`
- `apps/api/src/production-sessions/production-sessions.module.ts`
- `apps/api/src/production-sessions/production-sessions.controller.ts`
- `apps/api/src/production-sessions/production-sessions.service.ts`
- `apps/api/src/production-sessions/production-session.types.ts`

### Documentation

- `STRIKERS_MATCH_STUDIO_PROGRESS.md`

## Files modified

- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`
- `apps/api/src/events/events.service.ts`
- `apps/api/src/fight-cards/fight-cards.service.ts`
- `apps/api/src/production-sessions/production-session.types.ts`
- `apps/api/src/production-sessions/production-sessions.module.ts`
- `apps/api/src/production-sessions/production-sessions.service.ts`
- `apps/web/app/page.tsx`
- `apps/api/migrations/002_bridge_public_event_engine.sql`

## Next implementation steps

1. Add Studio-specific event data entry only for fields not already owned by the main event engine:
   - production notes
   - broadcast sponsor assignments
   - graphics payload presets
   - camera labels
2. Add camera browser connection workflow after SRS details exist.
3. Add Go Live workflow after SRS, FFmpeg, and Spaces details exist:
   - verify event is selected
   - verify destinations are configured
   - verify cameras are connected
   - start recording automatically
   - start RTMP distribution automatically
   - set event/session live state
4. Add End Stream workflow after SRS, FFmpeg, and Spaces details exist:
   - stop distribution
   - finalize MP4 recording
   - upload recording to DigitalOcean Spaces
   - link recording to event
5. Add React-based graphics rendering package under `packages/graphics` only when that vertical slice is approved.
6. Add SRS and FFmpeg infrastructure files after the required DigitalOcean host details exist.

## DigitalOcean requirements

See:

```text
infrastructure/digitalocean/DIGITALOCEAN_REQUIREMENTS.md
```

## Restrictions still active

- No AI features.
- No replay.
- No slow motion.
- No scorecards.
- No judges module.
- No rankings.
- No fighter statistics engine.
- No mobile app.
- No automated highlights.
- No automated clipping.
- No social content generation.
- No OAuth integrations.
- No platform-specific APIs.
- No direct-to-program switching.
- No server-side livestreaming until SRS/FFmpeg infrastructure is funded and deployed.
- No additional files outside the approved structure without approval.
