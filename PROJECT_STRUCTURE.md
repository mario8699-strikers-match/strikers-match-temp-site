# Strikers Match Studio Project Structure

## Structure Status

This document defines the approved Version 1 project structure specification.

It does not create application code, migrations, APIs, UI, services, or components.

No files or directories outside this specification may be created without approval.

## Required Stack

Frontend:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

Backend:

- NestJS

Database:

- PostgreSQL

Hosting:

- DigitalOcean

Storage:

- DigitalOcean Spaces

Media Server:

- SRS

Camera Protocol:

- WebRTC

Distribution:

- FFmpeg

Graphics:

- React-based graphics rendering

Production:

- Server-side production

## Planned Top-Level Structure

```text
strikersmatch-web/
  PRODUCT_REQUIREMENTS.md
  ARCHITECTURE.md
  DATABASE_SCHEMA.md
  DEVELOPMENT_RULES.md
  PROJECT_STRUCTURE.md
  apps/
    web/
    api/
  packages/
    graphics/
  infrastructure/
    digitalocean/
    srs/
    ffmpeg/
```

## Top-Level Responsibilities

### apps/web

Frontend application.

Required technology:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

Version 1 responsibilities:

- Events
- Fighters
- Sponsors
- Fight Cards
- Bouts
- Camera Sources
- Production Sessions
- Preview Panel
- Program Panel
- Camera Switching
- Round Timer
- Event Branding
- Fighter Intro Graphics
- Matchup Graphics
- Sponsor Overlays
- Recording state display
- Multistreaming controls

### apps/api

Backend application.

Required technology:

- NestJS

Version 1 responsibilities:

- Events
- Fighters
- Sponsors
- Fight Cards
- Bouts
- Camera Sources
- Production Sessions
- Preview / Program state
- Take workflow
- Round Timer state
- Graphics state
- Recording coordination
- Multistreaming coordination
- PostgreSQL persistence
- DigitalOcean Spaces references

### packages/graphics

React-based broadcast graphics rendering package.

Version 1 graphics:

- Event Branding
- Fighter Intro Graphics
- Matchup Graphics
- Sponsor Overlays

### infrastructure/digitalocean

DigitalOcean hosting and DigitalOcean Spaces infrastructure specification location.

Responsibilities:

- Hosting configuration specification
- Spaces configuration specification
- Recording storage references
- Asset storage references

### infrastructure/srs

SRS media server configuration specification location.

Responsibilities:

- Browser camera WebRTC ingest
- Server-side production media server support

### infrastructure/ffmpeg

FFmpeg distribution and recording configuration specification location.

Responsibilities:

- MP4 recording output
- RTMP distribution output

## Camera Structure Rules

Camera sources are browser cameras only.

Maximum cameras: 6.

Default camera roles:

1. Ring Wide
2. Ring Tight
3. Walkout
4. Crowd
5. Interview
6. Backup

Roles may be renamed per event.

No native iOS app, native Android app, or mobile application may be added.

## Streaming Structure Rules

Streaming destinations are reusable RTMP destination profiles only.

Supported platforms:

- YouTube
- Facebook
- Instagram
- TikTok
- Custom RTMP

No OAuth integration structure may be added.

No platform-specific API structure may be added.

## Asset Structure Rules

Only these asset types are supported:

- Event Logo
- Event Banner
- Fighter Headshot
- Sponsor Logo

No other asset type structure may be added.

## Prohibited Structure

Do not add:

- Mobile app directories
- AI directories
- Replay directories
- Slow motion directories
- Scorecard directories
- Judges directories
- Rankings directories
- Fighter statistics engine directories
- Automated highlights directories
- Automated clipping directories
- Social content generation directories
- OAuth integration directories
- Platform-specific API directories
- Plugin architecture directories
- Microservice architecture directories
- Event-driven architecture directories unless explicitly requested

## Approval Requirement

This structure must be approved before implementation.
