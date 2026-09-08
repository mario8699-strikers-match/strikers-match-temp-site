# Strikers Match Event Engine Roadmap

## Demo data note

`SATURDAY NIGHT STRIKERS – EVENTO 1.` currently has fake boxing-only demo data for the Thursday client presentation.

- Event ID: `e14f8b6c-f072-4fac-ac5b-ad347af15905`
- Demo users: `demo.boxer###.snse1@example.com`
- Remove after demo: `node scripts/cleanup-saturday-night-boxing-demo.mjs`
- See: `DEMO_DATA_NOTES.md`

## Purpose

This document is the implementation source of truth for integrating the complete event workflow into the existing Strikers Match application:

```text
Event
  -> Registration
  -> Eligibility
  -> Matchmaking Pool
  -> Match Suggestions
  -> Human Approval
  -> Bouts
  -> Bout Order and Mats
  -> Print Center
  -> Event-Day Operations
  -> Results
```

The matchmaking system is part of the event engine. It must not become a disconnected application or a second source of fighter, event, or bout data.

## Non-Negotiable Requirements

1. Preserve existing event, fighter, application, registration, request, payment, and match-confirmation behavior until its replacement is verified.
2. Use additive database migrations. Do not delete or rename production data in the same release that introduces its replacement.
3. Keep human approval in the matchmaking workflow. Suggestions must never automatically create an approved bout.
4. Make the marketplace event engine the authoritative source for registrations, eligibility, proposals, bouts, order, and results.
5. Treat Strikers Match Studio as a consumer of authoritative events, fighters, fight cards, and bouts, not as a competing identity system.
6. All new interfaces must be usable on mobile devices, tablets, and desktop screens.
7. Database authorization and invariants must not depend only on client-side checks.
8. Existing unrelated worktree changes must be preserved.

## Current System Baseline

Before implementation begins, preserve and test these existing flows:

- Fighters apply to events through `event_applications`.
- Promoters accept or decline applications.
- Fighters register and submit external payment through `event_registrations`.
- Promoters confirm payment.
- Promoters and managers send `match_requests` to registered or manual fighters.
- Promoters propose two-fighter pairings through `matches`.
- Both fighters accept or decline a proposed match.
- Reliability events are recorded for match responses, cancellations, and no-shows.
- Event pages, fighter profiles, promoter dashboards, and fighter match inboxes remain operational.

The current `matches` entity is a proposal/confirmation record. It is not yet an event-day bout.

## Current Implementation Snapshot

Last updated: 2026-08-17

### Implemented in this repository

- Baseline documentation exists in `EVENT_ENGINE_BASELINE.md`.
- Additive Supabase migrations were created for the event engine:
  - `20260817_event_engine_registration_foundation.sql`
  - `20260818_event_rules_bouts_foundation.sql`
  - `20260819_bout_operations.sql`
  - `20260820_admin_event_registration_insert_policy.sql`
  - `20260821_hardened_match_proposal_rpc.sql`
  - `20260822_replace_bout_fighter.sql`
  - `20260823_manager_event_engine_access.sql`
  - `20260824_match_discipline_enforcement.sql`
  - `20260825_event_staff_assignments.sql`
  - `20260826_event_staff_role_permissions.sql`
  - `20260827_event_staff_i18n_error_codes.sql`
- The live Supabase database has the event-engine tables/functions applied and schema-cache-visible:
  - `bouts`
  - `event_mats`
  - `event_divisions`
  - `event_matchmaking_settings`
  - `bout_audit_log`
  - `approve_confirmed_match_as_bout`
  - `generate_event_bout_order`
  - `update_bout_operation`
  - `event_staff`
  - `add_event_staff_by_email`
  - `remove_event_staff`
  - `has_event_staff_role`
  - `is_event_staff_member`
  - `is_event_day_operator`
  - `is_event_producer`
- Registration snapshots and eligibility fields have been added to `event_registrations`.
- A deterministic pairwise compatibility service exists in `services/compatibilityService.ts`.
- A bout service exists in `services/boutService.ts`.
- Event-level management routes exist:
  - `/events/[id]/manage/settings`
  - `/events/[id]/manage/matchmaking`
  - `/events/[id]/manage/bouts`
  - `/events/[id]/manage/print`
  - `/events/[id]/manage/live`
  - `/events/[id]/manage/streaming`
- Admin visibility route exists:
  - `/admin/matches`
- Admin dashboard stats include `matches` and `bouts` counts.
- Admin navigation includes the matches/bouts page.
- Mobile-first card layouts exist for the admin matches/bouts page, matchmaking board, and bout manager.
- Admin insert RLS for `event_registrations` is implemented and verified.
- Match proposal creation now uses the transactional `propose_event_match` RPC.
- Event settings and division management UI exists.
- Bout management now includes scheduled time, per-mat order, no-show action, elapsed seconds, and active-bout conflict warnings.
- Bout replacement now uses the audited `replace_bout_fighter` RPC and replacement controls in bout management.
- Print Center exists for full bout sheets, mat sheets, and fighter cards using current bout snapshots.
- Live Event Mode exists for mat-focused current/next queues and result entry.
- Event-engine role access is centralized through `has_event_staff_role`, `is_event_operator`, `is_event_day_operator`, `is_event_producer`, and matching assertion functions.
- Event-engine pages are available to promoter-owned events, manager-owned events, and admins.
- Event owners/admins can assign event-specific staff through `event_staff`.
- Assigned event staff access is role-specific for that event:
  - `manager`: matchmaking, bouts, and print center.
  - `operator`: event-day operation only.
  - `producer`: diffusion/Studio production only.
- Event settings and event staff assignment remain owner/admin-only.
- Event staff assignment accepts manager, promoter, and admin profiles and is protected by RLS/RPC owner-admin checks.
- The manager dashboard links directly to the event list and event creation.
- Repeated session/profile reads are deduped with a short in-memory session cache.
- Event-engine management pages now avoid loading restricted event data until operator permission is confirmed.
- Bout and live-event actions now update local state from returned RPC rows instead of reloading full datasets after each action.
- Matchmaking now treats discipline compatibility as a hard rule in both the client compatibility engine and the database.
- Supabase triggers prevent incompatible discipline pairings from being inserted into `matches` or `bouts`.
- Role-based onboarding modal exists for fighter, spectator, promoter, manager, sponsor, admin, and professional/vendor profiles.
- Onboarding copy is available in Spanish and English through the `onboarding` i18n namespace and follows the current language switcher.
- Onboarding is shown once per user/role/version and does not stack with the existing "What's new" modal during the same session.
- Spectator accounts can follow registered fighters and review followed fighter progress from a spectator dashboard.
- Public pricing/revenue strategy wording has been removed from user-facing surfaces.
- A demo reset action exists in the logged-in navigation to replay onboarding and "What's new" without database changes.
- Studio/live production remains separated from event-day operation while infrastructure work is pending.

### Verified live behavior

- Supabase Auth recovered after the database restart.
- The working admin email is `mc1986.99@gmail.com`.
- The double-dot email `mc1986..99@gmail.com` does not exist in `auth.users`.
- The admin account is confirmed, has `profiles.role = 'admin'`, and is not banned.
- RLS simulation as the admin user can read the admin profile row.
- RLS simulation as the admin user can read `event_registrations`.
- RLS simulation as the admin user can insert `event_registrations` inside a rolled-back transaction.
- RLS policies allow admin access to `matches`, `bouts`, mats, divisions, settings, and audit rows.
- The `bouts` table exists in the live schema and is reachable after Supabase recovered.
- The `propose_event_match` RPC exists in the live schema and migration history is recorded.
- The `replace_bout_fighter` RPC exists in the live schema and migration history is recorded.
- The `20260823` access migration is applied and recorded in migration history.
- The `20260824` discipline enforcement migration is applied and recorded in migration history.
- The `20260825` event staff migration is applied and recorded in migration history.
- The `20260826` event staff role permission migration is applied and verified in the live schema.
- The `20260827` event staff i18n error-code migration is applied and verified in the live schema.
- The `20260830` spectator/fighter follows migration is applied and verified in the live schema.
- Live database verification found 5 manager profiles and 0 manager-owned events.
- Current safe authorization model: event owners/admins can operate all tools for their events; assigned staff can access only their assigned event and only the feature area allowed by their event staff role.
- Live database verification found 0 incompatible active matches and 0 incompatible active bouts.

### Known gaps before continuing

- `propose_event_match` is live, but needs automated concurrency tests and a real-data event workflow test.
- Automated tests are still not configured. Do not mark any phase complete only because the UI renders.
- Print Center currently uses browser printing. Server-side PDF generation remains.
- Live Event Mode is not realtime yet and still needs concurrent-operator/offline handling.
- Mobile responsiveness has been designed into the new pages but has not been formally verified across every required viewport.
- Supabase migration history was repaired manually because the CLI had duplicate date-only migration history. Future migration work must check migration status before pushing.
- Event staff role permissions are implemented, but still need a full browser workflow test with one non-owner account per staff role.
- Continue reviewing expensive Supabase reads as each phase is hardened. The current priority is eliminating duplicated reads before adding realtime polling or PDF generation.
- Onboarding copy should be revisited before each client demo so the role-specific walkthrough reflects the features being presented.
- The Studio page now has local production UI, multistream destination setup UI, and demo camera-slot access codes.
- Studio camera access codes are not functional remote camera links yet. They must become one-time camera tokens with a camera join page, token validation, QR/share links, expiration/revocation, and WebRTC/SRS ingest before being presented as real multi-device camera support.
- Real public streaming/multistreaming still requires SRS/FFmpeg infrastructure before selling operational streaming.

## Delivery Rules

Each phase follows this sequence:

1. Confirm the current production behavior and data shape.
2. Add schema and server-side invariants.
3. Add or update TypeScript types and services.
4. Add UI behind the new data model.
5. Verify authorization, concurrency, accessibility, and responsive behavior.
6. Migrate or backfill existing data when required.
7. Remove legacy paths only in a later release after parity is proven.

No phase is complete solely because its UI renders.

## Mobile-Responsive Definition of Done

Every UI phase must be verified at, at minimum:

- 320 px wide mobile viewport
- 375 px wide mobile viewport
- 390/393 px modern mobile viewport
- 768 px tablet viewport
- 1024 px and larger desktop viewport

Required behavior:

- No horizontal page overflow.
- No clipped buttons, dialogs, labels, tables, or fighter details.
- Tap targets are at least 44 by 44 CSS pixels where practical.
- Primary actions remain visible and reachable without hover.
- Keyboard focus is visible and the workflow is usable without a mouse.
- Dialogs and drawers fit the viewport and scroll internally when necessary.
- Dense tables transform into cards, stacked rows, or controlled horizontal regions on small screens.
- Drag-and-drop always has tap-based controls as an equivalent alternative.
- Filters use a mobile drawer or collapsible panel rather than consuming the full screen.
- Matchmaking comparisons stack vertically on mobile and appear side-by-side when space permits.
- Status must not be communicated by color alone.
- Print layouts are independent from responsive screen layouts.
- Safe-area insets are respected for sticky mobile controls.
- Loading, empty, validation, conflict, and error states are responsive too.

Automated viewport checks should be added for critical paths, with manual device verification before release.

## Phase 0 — Baseline and Safety Net

### Scope

- Document the deployed Supabase migration state.
- Inventory existing event/application/registration/request/match data.
- Add tests around the current critical workflows.
- Record existing RLS policies and authorization expectations.
- Decide the integration boundary between the Supabase marketplace and the PostgreSQL/NestJS Studio workspace.

### Required decisions

- Confirm that the marketplace owns authoritative bout records.
- Decide whether Studio reads the shared database or consumes a versioned API.
- Decide whether `matches` remains the physical name for proposals or is migrated later to `match_proposals`.

### Exit criteria

- Existing workflow smoke tests pass.
- A database backup and rollback procedure is documented.
- The marketplace/Studio ownership boundary is approved.
- No production table has been removed or destructively renamed.

## Phase 1 — Registration and Eligibility Foundation

### Scope

Make one event registration the authoritative entry for a fighter at an event.

Add or normalize:

- Application/approval status
- Payment status
- Eligibility status and reason codes
- Event-entered discipline and weight
- Weigh-in weight and verification timestamp
- Belt/rank snapshot
- Experience and record snapshot
- Age and age-class snapshot
- Gender/division data required by configured rules
- Team/gym snapshot
- Ruleset and format preferences
- Availability confirmation
- Medical clearance state
- Minor-consent state
- Registration close timestamp
- Audit timestamps and actor IDs

### Migration strategy

- Add fields/tables without removing `event_applications`.
- Link or backfill existing applications and registrations.
- Provide compatibility reads while legacy and new records coexist.
- Detect and report conflicting or orphaned records instead of silently merging them.

### Eligibility engine

Return structured results:

```text
eligible
hard failure reasons
warnings
evaluated rule version
evaluated timestamp
```

Payment confirmation alone must not imply full eligibility.

### Mobile deliverables

- Registration form uses one-column mobile layout.
- Long category choices use searchable/selectable mobile controls.
- Eligibility failures are readable as stacked alerts.
- Promoter registration lists become cards on small screens.
- Important actions may use a safe-area-aware sticky action bar.

### Exit criteria

- One authoritative registration can represent the complete event entry.
- Existing registrations and applications remain accessible.
- Eligibility is explainable and reproducible.
- Mobile registration and promoter review pass the responsive definition of done.

## Phase 2 — Event Rules and Divisions

### Scope

Add event-owned configuration for:

- Divisions
- Disciplines and rulesets
- Gi/No-Gi or equivalent format
- Weight classes and tolerances
- Age classes and permitted cross-class pairings
- Gender/division restrictions
- Belt/rank compatibility
- Experience compatibility
- Same-team policy
- Recent-opponent lookback
- Maximum bouts per fighter
- Rest-time constraints
- Mat configuration

Rules must be versioned or snapshotted so existing bouts do not change when event settings are edited.

### Mobile deliverables

- Settings are grouped into short sections or steps.
- Repeated division/rule entries use responsive cards.
- Validation summaries link to the relevant field.

### Exit criteria

- An event can express every hard compatibility rule needed by the engine.
- Invalid or incomplete settings prevent pool generation with clear reasons.
- Settings are usable at all required viewports.

## Phase 3 — Pairwise Matchmaking Engine

### Scope

Replace event-to-fighter ranking with fighter-to-fighter compatibility.

Evaluate hard requirements first:

- Registration and eligibility state
- Weight tolerance
- Age-class rules
- Gender/division rules
- Discipline and ruleset
- Existing active assignment
- Suspension/medical/consent state
- Same-team policy
- Recent-opponent policy
- Maximum bouts and rest constraints

Score only valid candidates:

- Weight difference
- Age difference
- Experience/record difference
- Belt/rank difference
- Opponent history
- Explicit opponent preferences
- Reliability as a warning or configured factor

### Output contract

```text
fighter A registration
fighter B registration
eligible boolean
hard failures
warnings
total score
score breakdown
rule version
```

Generate candidate combinations on demand initially. Persist reviewed suggestions/proposals and their scoring snapshots, not every possible combination.

### Testing

- Unit tests for every hard rule and score boundary.
- Symmetry tests: A versus B must equal B versus A.
- Deterministic scoring tests.
- Edge cases around missing data and class boundaries.
- Performance test on realistically sized event pools.

### Exit criteria

- Invalid candidates never receive an actionable suggestion.
- Every score is explainable.
- The engine cannot double-assign a fighter through concurrent actions.

## Phase 4 — Proposal Security and Matchmaking Board

### Database and service scope

- Create proposals through a transactional database function/server endpoint.
- Lock/recheck both registrations during creation.
- Prevent multiple active assignments when prohibited.
- Restrict each fighter to changing only their own response.
- Support cancelling and, when allowed, re-proposing a previously cancelled pair.
- Preserve reliability side effects without double-applying them.
- Record proposer, approver, timestamps, score snapshot, warnings, and overrides.

### Board scope

- Event summary counts
- Eligible, ineligible, matched, unmatched, and conflicted registrations
- Search and filters
- Suggested opponents with score breakdown
- Hard failure and warning explanations
- Manual pair selection
- Approve/reject proposal
- Fighter acceptance status
- Replacement workflow entry point

### Mobile interaction model

- Use stacked fighter comparison cards below the tablet breakpoint.
- Open filters in a drawer/sheet.
- Provide explicit `Select fighter`, `Compare`, `Move up/down`, and `Create proposal` controls.
- Do not require drag-and-drop; drag-and-drop is optional enhancement only.
- Keep the active fighter context visible while browsing candidates.
- Avoid multi-column data tables on phones.

### Exit criteria

- A promoter can build proposals for a full event from mobile or desktop.
- Human approval remains mandatory.
- Authorization and double-booking tests pass.
- Existing fighter match inbox behavior remains compatible.

## Phase 5 — Permanent Bouts

### Scope

Create the authoritative marketplace `bouts` model with:

- Event ID
- Source proposal ID
- Both event-registration IDs
- Fighter identity snapshots
- Division, discipline, ruleset, format, weight, age, rank, and experience snapshots
- Mat assignment
- Event-wide bout number
- Per-mat sequence
- Scheduled time
- Status
- Result, winner, method, and elapsed time
- Notes
- Replacement/cancellation metadata
- Created/updated/approved/completed timestamps and actor IDs

Suggested lifecycle:

```text
PROPOSED
APPROVED
CONFIRMED
READY
IN_PROGRESS
COMPLETED
CANCELLED
NO_SHOW
```

Replacement is better represented as an audited action/reason than as a stable terminal status.

### Creation rules

- A confirmed proposal creates at most one bout.
- Bout creation is transactional and idempotent.
- Historical fighter and rule snapshots remain unchanged after profile edits.
- Replacements preserve bout identity and append audit history.

### Mobile deliverables

- Bout cards expose the most important fields first.
- Editing uses a full-screen mobile sheet or page.
- Status actions are large, explicit, and confirmation-protected.

### Exit criteria

- Confirmed proposals reliably become permanent bouts.
- Bout history survives substitutions and corrections.
- Studio integration can identify the authoritative bout.

## Phase 6 — Mats and Bout Order

### Scope

- Create and configure event mats/rings.
- Generate event-wide bout numbers transactionally.
- Assign per-mat order.
- Detect fighter, coach/team, and minimum-rest conflicts.
- Support manual reorder with audit history.
- Support scheduled-time calculation and regeneration previews.

### Mobile interaction model

- Each mat is a selectable tab or compact switcher.
- Reordering includes accessible up/down and move-to-position controls.
- Drag-and-drop is an optional desktop/tablet enhancement.
- Conflict messages remain attached to the affected bout.

### Exit criteria

- Ordering produces stable unique numbers.
- Regeneration never silently overwrites manual changes.
- Mat management is fully operable without a mouse.

## Phase 7 — Print Center

### Outputs

- Full event bout sheet
- Per-mat sheet
- Fighter bout card
- Coach/team sheet
- Weigh-in sheet
- Results sheet

### Implementation requirements

- Generate PDFs server-side from authoritative snapshots.
- Store generation timestamp and event revision.
- Support Spanish text, accents, and Mexican date/time formatting.
- Define intentional Letter and/or A4 print layouts.
- Keep print CSS/templates separate from responsive application UI.

### Mobile deliverables

- Admin can choose, preview metadata for, and download/share outputs on mobile.
- Print configuration uses a one-column layout on phones.
- Large PDF previews are optional; downloading must remain available.

### Exit criteria

- Identical data produces consistent PDFs across admin devices.
- Every output is legible in its target paper format.

## Phase 8 — Event-Day Mode and Results

### Scope

- Per-mat current and next bout queues
- READY -> IN_PROGRESS -> COMPLETED transitions
- Cancellation and no-show paths
- Winner, method, elapsed time, and notes
- Queue advancement with explicit operator confirmation
- Realtime updates for authorized event staff
- Public result publication controls

### Mobile deliverables

- Event-day mode prioritizes one-handed operation.
- Current-bout actions remain visible in a safe-area-aware footer.
- Destructive actions require confirmation.
- Connectivity loss is visible and does not falsely report saved state.
- Optimistic UI is used only when rollback behavior is reliable.

### Exit criteria

- Multiple mats can operate without assigning or completing the wrong bout.
- Result updates are audited.
- Reconnect and concurrent-operator tests pass.

## Phase 9 — Studio Integration

### Scope

- Establish a stable shared schema or versioned API contract.
- Map marketplace event/fighter/bout IDs into Studio.
- Feed fight cards, active bouts, and fighter snapshots to production graphics.
- Ensure Studio does not create duplicate authoritative fighters or bouts.
- Define retry, offline, stale-data, and reconciliation behavior.

### Exit criteria

- Selecting an authoritative marketplace bout can drive Studio's active bout.
- Identity mapping is durable and observable.
- Temporary Studio failures cannot corrupt marketplace event operations.

## Phase 10 — Tournament Formats

Start only after individual-bout operations are stable.

Potential formats:

- Open matchmaking
- Round robin
- Single elimination
- Double elimination

Bracket progression must build on authoritative registrations, bouts, results, mats, and scheduling rather than creating a parallel system.

## Cross-Cutting Test Matrix

Every affected phase must cover:

- Anonymous, fighter, promoter, manager, admin, and event-staff authorization
- Supabase RLS or API authorization bypass attempts
- Concurrent proposal, approval, ordering, and result actions
- Duplicate submission and idempotency
- Existing-data migration and rollback
- Spanish and English UI strings where the screen is localized
- Empty, partial, loading, stale, conflict, and error states
- 320, 375, 390/393, 768, 1024, and wide desktop viewports
- Touch, keyboard, and pointer input
- Slow and interrupted networks
- Print/PDF snapshot checks

## Release and Rollback Checklist

Before each production release:

- Back up affected data.
- Apply migrations in a staging environment first.
- Run migration verification queries.
- Run existing-flow regression tests.
- Run new-flow authorization and concurrency tests.
- Run responsive checks at all required viewports.
- Confirm monitoring for database/API errors.
- Document rollback steps that preserve newly written data.
- Keep legacy reads available until new-path stability is confirmed.

## Progress Tracker

Update this section when work is completed. Do not mark a phase complete until all exit criteria pass.

| Phase | Status | Notes |
| --- | --- | --- |
| 0. Baseline and safety net | Partially complete | Boundary and verification baseline recorded; repo-wide lint baseline documented; automated workflow coverage and rollback runbook remain |
| 1. Registration and eligibility | Partially complete | Additive eligibility migration, snapshot fields, helper functions, admin insert RLS, and status display started; full eligibility UI remains |
| 2. Event rules and divisions | Partially complete | Settings, divisions, mats schema, and event settings/division management UI created; validation hardening remains |
| 3. Pairwise matchmaking engine | Partially complete | Initial deterministic hard-rule and scoring engine created; automated domain tests and performance checks remain |
| 4. Proposal security and board | Partially complete | Mobile-responsive board and transactional proposal RPC created; automated concurrency tests and real-data workflow test remain |
| 5. Permanent bouts | Partially complete | Authoritative bout schema, approval function, snapshots, status fields, audit log, and audited replacement workflow created; deeper validation remains |
| 6. Mats and bout order | Partially complete | Responsive bout manager, mat creation, transactional order generation, scheduled time, per-mat order, replacement controls, and conflict warnings created; regeneration preview remains |
| 7. Print center | Partially complete | Browser print center created for full bout sheet, mat sheets, and fighter cards; server-side PDF generation remains |
| 8. Event-day mode and results | Partially complete | Dedicated live event screen, audited status/result operations, and mobile controls created; realtime, offline/error handling, and multi-operator checks remain |
| 9. Studio integration | Not started | Ownership/integration boundary requires approval |
| 10. Tournament formats | Deferred | Begins only after individual-bout operations stabilize |

## Decision Log

Record architecture and workflow decisions here before implementing dependent phases.

| Date | Decision | Reason | Affected phases |
| --- | --- | --- | --- |
| 2026-08-17 | Matchmaking is part of the event engine | Registration, proposals, bouts, ordering, printing, and event-day operation share one lifecycle | All |
| 2026-08-17 | Mobile responsiveness is required for every UI phase | Promoters and event staff must be able to operate the system from mobile devices | All UI phases |
| 2026-08-17 | Root Next.js/Supabase app owns event-engine records | It already owns marketplace identities, event registration, payments, and pairing proposals | 1–9 |
| 2026-08-17 | New event-engine UI uses no gradients, decorative icons, emojis, or AI-style effects | New work must follow the existing restrained Strikers Match visual language | All UI phases |
| 2026-08-17 | `matches` remains proposal/confirmation data; `bouts` is the permanent event-day record | Keeps fighter acceptance separate from event operations, result tracking, print sheets, and future brackets | 4–10 |
| 2026-08-17 | Admin panel must expose both proposals and permanent bouts | Admin needs global visibility into all match and bout records, not only event-specific screens | 4–8 |
| 2026-08-17 | The working admin email is `mc1986.99@gmail.com` | Live `auth.users` has no row for the double-dot email | Auth/Admin verification |
| 2026-08-17 | Managers receive full event-engine access for events they own/create; admins remain global | Global manager access would expose every promoter event without an assignment model | Authorization, 1–8 |
| 2026-08-17 | Discipline compatibility is mandatory for suggestions, matches, and bouts | A kickboxer cannot be matched with a fighter who only does MMA; shared/registered discipline is required | 3–5 |
| 2026-08-17 | Only fighter requests/replacements and event live streaming are paid | Statistics, event management, registration, matchmaking, bouts, and printing should remain free to use | Monetization |
| 2026-08-17 | Promoter/admin-owned events can assign event-specific staff | Managers/operators/producers need scoped access without exposing every promoter event | Authorization, 4–8 |

## Immediate Next Step

Do not restart from Phase 0. Continue from the current partially implemented state.

Next ordered work:

1. Re-run targeted route checks after the Supabase compute upgrade.
2. Browser-test event staff assignment with a non-owner manager account.
3. Add or choose a test runner before marking phases 1-8 complete.
4. Finish result validation hardening.
5. Add server-side PDF generation for Print Center.
6. Add realtime refresh and concurrent-operator handling for Live Event Mode.
7. Add the real streaming provider workflow behind the existing premium streaming gate.
8. Start Studio integration only after the event engine workflow is stable.
