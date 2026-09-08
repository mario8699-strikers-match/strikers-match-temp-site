# Strikers Match Studio Product Requirements

## Project

Project name: Strikers Match Studio

Purpose: Browser-based boxing and combat sports production platform integrated into Strikers Match.

Scope: Version 1 only.

No Version 2 planning, future features, or future architecture are included in this specification.

## Product Positioning

Strikers Match Studio is a broadcast control room for boxing and combat sports events.

It is not:

- A startup dashboard
- A marketing website
- A social media application
- An AI product interface

## Version 1 Features

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
- Recording
- Multistreaming

## Version 1 Exclusions

- No AI features
- No Replay
- No Slow Motion
- No Scorecards
- No Judges
- No Rankings
- No Fighter Statistics Engine
- No Mobile App
- No Automated Highlights
- No Automated Clipping
- No Social Content Generation

## Camera System

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

Camera protocol: WebRTC.

Default camera roles:

1. Ring Wide
2. Ring Tight
3. Walkout
4. Crowd
5. Interview
6. Backup

Camera roles may be renamed per event.

## Production Workflow

The production workflow is Preview / Program.

Required behavior:

1. Operator selects source in Preview.
2. Operator presses Take.
3. Preview becomes Program.

Direct-to-program switching is not allowed.

## Go Live Workflow

Required behavior:

1. Select Event.
2. Configure Destinations.
3. Connect Cameras.
4. Press Go Live.
5. Recording starts automatically.
6. Distribution starts automatically.
7. Event enters live state.

## End Stream Workflow

Required behavior:

1. Press End Stream.
2. Distribution stops.
3. Recording finalizes.
4. Recording uploads to DigitalOcean Spaces.
5. Recording links to event.

## Streaming Destinations

Supported destinations:

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

Not allowed:

- OAuth integrations
- Platform-specific APIs

Only RTMP destination profiles are allowed.

## Recording

Recording starts automatically when Go Live is pressed.

Recording cannot be disabled.

Recording format: MP4.

Storage: DigitalOcean Spaces.

## Assets

Supported asset types:

- Event Logo
- Event Banner
- Fighter Headshot
- Sponsor Logo

No other asset types are allowed in Version 1.

## User Interface Requirements

The application must feel like a broadcast control room.

Visual characteristics:

- Dark theme
- Dense information
- Functional controls
- Production-focused workflows

Design inspiration:

- OBS
- vMix
- Blackmagic ATEM
- Switcher Studio

Avoid:

- Gradients
- Oversized spacing
- Unnecessary animations
- Trendy SaaS layouts
- AI-generated visual styles

## Acceptance Criteria

- The project specification covers Version 1 only.
- The specified Version 1 features are included.
- The specified Version 1 exclusions are excluded.
- Camera ingest is browser-only.
- Maximum simultaneous cameras is 6.
- Preview / Program switching is required.
- Direct-to-program switching is prohibited.
- Recording starts automatically on Go Live.
- Recording cannot be disabled.
- Recording format is MP4.
- Recordings are stored in DigitalOcean Spaces.
- Streaming destinations are RTMP destination profiles only.
- Destination profiles may be reused across events.
- No OAuth integrations are included.
- No platform-specific APIs are included.
- Only the specified asset types are supported.
