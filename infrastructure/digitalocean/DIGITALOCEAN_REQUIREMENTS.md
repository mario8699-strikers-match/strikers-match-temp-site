# DigitalOcean Requirements for Strikers Match Studio

## Purpose

This file lists the exact DigitalOcean resources and values required to finish the Strikers Match Studio live streaming implementation.

The Studio application cannot complete real live streaming, recording, or RTMP distribution until these resources exist.

## Current no-server phase

Current decision:

```text
Do not add a new DigitalOcean Droplet or managed database yet.
```

The Studio application can continue with:

- Supabase PostgreSQL for Studio control data
- DigitalOcean Spaces for public assets
- browser camera preview
- browser-side local recording
- manual download of recordings to the operator's device

The following values are intentionally not required during this phase:

```text
SRS_PUBLIC_URL
SRS_WEBRTC_INGEST_BASE_URL
SRS_API_URL
SRS_RTMP_BASE_URL
SRS_DOMAIN
FFMPEG_WORKER_HOST
FFMPEG_WORKER_API_URL
RECORDING_OUTPUT_PATH
```

Those values only become necessary when the funded server streaming phase starts.

## Required DigitalOcean resources

### 1. App Platform or Droplet for Studio API

Required for:

- NestJS API deployment
- production session control
- camera source state
- Preview / Program state
- Take workflow
- round timer state
- destination profile management
- recording and stream output coordination

Needed values:

```text
STUDIO_API_PUBLIC_URL=
NODE_ENV=production
PORT=3001
```

### 2. App Platform or static deployment for Studio Web

Required for:

- browser control room UI
- operator dashboard
- Preview / Program controls
- round timer controls
- camera controls
- destination controls

Needed values:

```text
NEXT_PUBLIC_STUDIO_API_URL=
```

This must point to the real deployed Studio API URL once the API is deployed on DigitalOcean.

### 3. PostgreSQL database

Current decision:

```text
Use existing upgraded Supabase PostgreSQL for Studio.
```

The Studio tables are isolated in the `studio` schema so they do not collide with the existing Strikers Match app tables in `public`.

The Studio API can derive its database connection from existing Supabase env values:

```text
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_DB_PASSWORD
```

No DigitalOcean Managed PostgreSQL database is required right now.

### 4. DigitalOcean Spaces bucket

Required for:

- event logos
- event banners
- fighter headshots
- sponsor logos
- finalized MP4 recordings

Needed values:

```text
DO_SPACES_ENDPOINT=
DO_SPACES_REGION=
DO_SPACES_BUCKET=
DO_SPACES_ACCESS_KEY=
DO_SPACES_SECRET_KEY=
DO_SPACES_PUBLIC_BASE_URL=
```

### 5. SRS media server host

Status:

```text
Deferred until server budget exists.
```

Required for:

- browser camera WebRTC ingest
- server-side production media routing

Needed values:

```text
SRS_PUBLIC_URL=
SRS_WEBRTC_INGEST_BASE_URL=
SRS_API_URL=
SRS_RTMP_BASE_URL=
```

Required open ports depend on final SRS config, but the expected categories are:

- HTTPS/WSS for browser WebRTC access
- SRS API access from the Studio API
- RTMP access from FFmpeg/internal production services
- UDP ports required by WebRTC

### 6. FFmpeg worker host

Status:

```text
Deferred until server budget exists.
```

Required for:

- MP4 recording
- RTMP distribution to destination profiles
- server-side production output

Needed values:

```text
FFMPEG_WORKER_HOST=
FFMPEG_WORKER_API_URL=
RECORDING_OUTPUT_PATH=
```

This host must be able to:

- read the SRS production feed
- write temporary MP4 recording files
- upload finalized MP4 files to DigitalOcean Spaces
- push RTMP output to YouTube, Facebook, Instagram, TikTok, or Custom RTMP URLs

### 7. Domain and TLS

Required for:

- browser camera access
- WebRTC secure context
- production web app
- production API
- SRS WebRTC endpoints

Needed values:

```text
STUDIO_WEB_DOMAIN=
STUDIO_API_DOMAIN=
SRS_DOMAIN=
```

Browser camera/WebRTC workflows must run over HTTPS/WSS in production.

## Required secrets

These must be configured in environment variables, not hard-coded.

Required now:

```text
NEXT_PUBLIC_STUDIO_API_URL
DO_SPACES_ENDPOINT
DO_SPACES_REGION
DO_SPACES_BUCKET
DO_SPACES_ACCESS_KEY
DO_SPACES_SECRET_KEY
DO_SPACES_PUBLIC_BASE_URL
```

Required later for the server streaming phase:

```text
SRS_PUBLIC_URL
SRS_WEBRTC_INGEST_BASE_URL
SRS_API_URL
SRS_RTMP_BASE_URL
FFMPEG_WORKER_HOST
FFMPEG_WORKER_API_URL
RECORDING_OUTPUT_PATH
```

## What is blocked until these exist

- real browser camera ingest
- real SRS WebRTC sessions
- real FFmpeg recording
- real RTMP distribution
- real MP4 upload to Spaces
- production Go Live workflow
- production End Stream workflow

## What can continue before DigitalOcean is ready

- destination profile database/API/UI
- event destination link database/API/UI
- round timer database/API/UI
- active bout selection
- local browser camera preview
- local browser recording and download
- graphics cue database/API/UI
- Studio control-room UI refinement
- migration validation against Supabase PostgreSQL
