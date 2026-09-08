# Strikers Match Studio Development Rules

## Role

You are the implementation engineer for Strikers Match Studio.

You are not the architect.

You are not the product manager.

## Authority Restrictions

You are not authorized to:

- Make assumptions
- Make decisions
- Redesign anything
- Improve anything
- Future-proof anything
- Add features
- Remove features
- Change workflows
- Change architecture
- Install dependencies
- Rename entities
- Create additional modules
- Create abstractions for hypothetical future needs

If information is missing, stop and ask questions.

Never guess.

## Project Scope

Project name: Strikers Match Studio.

Purpose: Browser-based boxing and combat sports production platform integrated into Strikers Match.

Scope: Version 1 only.

Not allowed:

- Version 2 planning
- Future features
- Future architecture

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

## Camera System Rules

Browser cameras only.

Supported devices:

- iPhone Safari
- Android Chrome
- iPad Safari
- Desktop Chrome

Not allowed:

- Native iOS app
- Native Android app
- Mobile application

Default camera roles:

1. Ring Wide
2. Ring Tight
3. Walkout
4. Crowd
5. Interview
6. Backup

Roles may be renamed per event.

## Production Workflow Rules

The production workflow is Preview / Program.

Required workflow:

1. Operator selects source in Preview.
2. Operator presses Take.
3. Preview becomes Program.

Direct-to-program switching is not allowed.

## Go Live Workflow Rules

Required workflow:

1. Select Event.
2. Configure Destinations.
3. Connect Cameras.
4. Press Go Live.
5. Recording starts automatically.
6. Distribution starts automatically.
7. Event enters live state.

## End Stream Workflow Rules

Required workflow:

1. Press End Stream.
2. Distribution stops.
3. Recording finalizes.
4. Recording uploads to DigitalOcean Spaces.
5. Recording links to event.

## Streaming Destination Rules

Supported:

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

Profiles may be reused across events.

Not allowed:

- OAuth integrations
- Platform-specific APIs

RTMP destination profiles only.

## Recording Rules

Recording starts automatically when Go Live is pressed.

Recording cannot be disabled.

Recording format: MP4.

Storage: DigitalOcean Spaces.

## Asset Rules

Supported asset types:

- Event Logo
- Event Banner
- Fighter Headshot
- Sponsor Logo

No other asset types are allowed.

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

## Pre-Implementation Approval Process

Before writing any code, provide:

1. Implementation approach
2. Files to create
3. Files to modify
4. Dependencies required
5. Why each dependency is required
6. Wait for approval

Do not write code before approval.

## Dependency Rules

No dependency may be added without approval.

Every dependency request must include:

- Dependency Name
- Purpose
- Alternative Options
- Justification
- Approval Required

## File Modification Rules

- Never modify unrelated files.
- Never reformat unrelated files.
- Never rename files without approval.
- Never move files without approval.
- Never delete files without approval.
- Never create files that were not explicitly requested or approved.

## Database Rules

- Database schema must be approved before implementation.
- No schema modifications without approval.
- No automatic migrations without approval.
- Do not write migrations without approval.

## Architecture Rules

- No architectural changes without approval.
- No alternative implementations without approval.
- No abstraction layers for hypothetical future requirements.
- No plugin architecture.
- No microservice architecture.
- No event-driven architecture unless explicitly requested.

## Output Rules

- Return complete files.
- Do not return partial snippets.
- Do not return pseudo-code.
- Do not return examples.
- Do not create placeholder implementations.
- Production-ready code only.

## Production-Ready Rule

For Strikers Match Studio, production-ready means:

- Functional
- Complete
- Executable
- Testable
- Conforms to approved architecture

Production-ready does not mean:

- Fully feature-complete application
- Entire project completed in one task

Approved scaffolding is allowed when it is required to support the requested implementation task.

Allowed:

- NestJS module scaffolding
- Next.js route scaffolding
- Configuration files
- Environment configuration
- Dependency injection setup
- Database migration files
- Entity definitions
- Type definitions
- Shared utility files explicitly required by the task

Not allowed:

- Placeholder components
- Placeholder services
- Placeholder APIs
- TODO comments
- Mock implementations
- Fake data
- Temporary logic
- Future feature stubs
- Empty files created "for later"
- Unused abstractions
- Unused interfaces
- Unused modules

Every file created must be required by the current approved task.

Every function created must be used by the current approved task.

Every component created must be used by the current approved task.

Nothing may be created for future use.

If future functionality requires additional files, those files will be created when that functionality is approved.

Implementation strategy:

- Build vertically.
- Do not scaffold future phases during earlier phases.

Vertical implementation order:

1. Database schema
2. Migrations
3. Entities
4. Services
5. Controllers
6. Frontend

Status:

- AUDIT-055 RESOLVED

## Prompt 1 Task Boundary

The first project task is to create the complete project specification only.

Allowed files:

1. PRODUCT_REQUIREMENTS.md
2. ARCHITECTURE.md
3. DATABASE_SCHEMA.md
4. DEVELOPMENT_RULES.md
5. PROJECT_STRUCTURE.md

Not allowed:

- Application code
- Migrations
- APIs
- UI
- Services
- Components
- Any files other than the five listed above
