# Strikers Match Studio Architecture

## Scope

This document defines the Version 1 architecture for Strikers Match Studio.

No Version 2 planning, future architecture, alternative implementation, or redesign is included.

## Required Architecture

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

Maximum Cameras:

- 6

## System Components

### Frontend

The frontend is a Next.js, TypeScript, Tailwind CSS, and shadcn/ui application.

Responsibilities:

- Events interface
- Fighters interface
- Sponsors interface
- Fight Cards interface
- Bouts interface
- Camera Sources interface
- Production Sessions interface
- Preview Panel
- Program Panel
- Camera Switching controls
- Round Timer controls
- Event Branding controls
- Fighter Intro Graphics controls
- Matchup Graphics controls
- Sponsor Overlay controls
- Recording state display
- Multistreaming controls

### Backend

The backend is a NestJS application.

Responsibilities:

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
- Event Branding state
- Fighter Intro Graphics state
- Matchup Graphics state
- Sponsor Overlay state
- Recording coordination
- Multistreaming coordination
- DigitalOcean Spaces asset and recording references
- PostgreSQL persistence

### Database

The database is PostgreSQL.

Responsibilities:

- Persist Version 1 product data.
- Persist reusable RTMP destination profiles.
- Persist event links to selected destination profiles.
- Persist production session state.
- Persist recording records linked to events.

### Hosting

Hosting target is DigitalOcean.

### Storage

DigitalOcean Spaces stores:

- Event Logo
- Event Banner
- Fighter Headshot
- Sponsor Logo
- MP4 recordings

No other asset types are supported in Version 1.

### Media Server

SRS is the media server.

Responsibilities:

- Browser camera WebRTC ingest
- Media server support for server-side production

### Distribution

FFmpeg handles distribution and recording output.

Responsibilities:

- MP4 recording generation
- RTMP distribution to configured destination profiles

### Graphics

Graphics rendering is React-based.

Supported graphics:

- Event Branding
- Fighter Intro Graphics
- Matchup Graphics
- Sponsor Overlays

## Camera Architecture

Camera sources are browser cameras only.

Supported devices:

- iPhone Safari
- Android Chrome
- iPad Safari
- Desktop Chrome

Not allowed:

- Native iOS app
- Native Android app
- Mobile application

Maximum cameras: 6.

Default camera roles:

1. Ring Wide
2. Ring Tight
3. Walkout
4. Crowd
5. Interview
6. Backup

Roles may be renamed per event.

## Production Architecture

Production is server-side.

The required production workflow is Preview / Program:

1. Operator selects source in Preview.
2. Operator presses Take.
3. Preview becomes Program.

Direct-to-program switching is not allowed.

## Go Live Workflow

1. Select Event.
2. Configure Destinations.
3. Connect Cameras.
4. Press Go Live.
5. Recording starts automatically.
6. Distribution starts automatically.
7. Event enters live state.

## End Stream Workflow

1. Press End Stream.
2. Distribution stops.
3. Recording finalizes.
4. Recording uploads to DigitalOcean Spaces.
5. Recording links to event.

## Streaming Destination Architecture

Supported destination platforms:

- YouTube
- Facebook
- Instagram
- TikTok
- Custom RTMP

Destination profile fields:

- Name
- Platform
- RTMP URL
- Stream Key
- Status

Destination profiles may be reused across events.

Only RTMP destination profiles are allowed.

Not allowed:

- OAuth integrations
- Platform-specific APIs

## Recording Architecture

Recording starts automatically when Go Live is pressed.

Recording cannot be disabled.

Recording format: MP4.

Recording storage: DigitalOcean Spaces.

Finalized recordings must link to the event.

## Architecture Prohibitions

- No architecture changes without approval.
- No alternative implementations without approval.
- No abstraction layers for hypothetical future needs.
- No plugin architecture.
- No microservice architecture.
- No event-driven architecture unless explicitly requested.
- No native iOS app.
- No native Android app.
- No mobile application.
- No OAuth integrations.
- No platform-specific APIs.
