# Matchmaking to Bout Presentation Roadmap

Last updated: 2026-09-07

## Product outcome

Strikers Match must support this authoritative event workflow:

```text
Event published
  -> Fighters or authorized event staff register participants
  -> Eligibility is evaluated
  -> Match suggestions refresh automatically
  -> Promoter/manager accepts, rejects, or modifies a suggestion
  -> Fighters or an authorized representative confirm the proposal
  -> Promoter/manager approves the official bout
  -> Bout graphics are generated from immutable snapshots
  -> Graphics can be reviewed, published, downloaded, or shown in Screen Mode
```

Suggestions never become official bouts without human approval.

## Authoritative data decisions

- `event_registrations` is the event-participant record.
- A registration may reference either a platform `fighter` or a `manual_fighter`, never both.
- `matches` remains the proposal/confirmation record.
- `bouts` remains the authoritative approved fight-card record.
- Event-specific values are snapshotted on registrations and bouts so later profile edits do not silently change an approved card.
- Medical details, birth dates, contact information, and special restrictions are restricted to authorized event staff. Public cards display only safe presentation fields.
- Compatibility is an explainable score out of 100, not a safety guarantee or probability.

## Required fighter and event fields

| Requested field | Source of truth | Public fighter card | Event matchmaking card |
| --- | --- | --- | --- |
| Weight class | fighter/manual fighter + registration snapshot | Yes | Yes |
| Actual registered weight | event registration | No | Yes |
| Age | DOB, calculated for event date | Age only | Yes |
| Gender/division | fighter/manual fighter + registration | Optional | Yes |
| Experience level | fighter/manual fighter + registration | Yes | Yes |
| Record and wins/losses | fighter/manual fighter + registration | Yes | Yes |
| KO/TKO record | fighter/manual fighter + registration | Yes | Yes |
| Discipline | fighter/manual fighter + registration | Yes | Yes |
| Ruleset | fighter/manual fighter + registration | Yes | Yes |
| Amateur/pro | experience level | Yes | Yes |
| Skill/experience rating | fighter/manual fighter + registration | Yes | Yes |
| Gym/team | fighter/manual fighter + registration | Yes | Yes |
| Geographic location | profile/manual fighter + registration | City/state | Yes |
| Previous opponents/history | approved/completed bouts | Summary | Yes |
| Availability | fighter/manual fighter + registration | Summary | Yes |
| Requested weight | fighter/manual fighter + registration | Optional | Yes |
| Acceptable weight range | fighter/manual fighter + registration | Optional | Yes |
| Special restrictions | registration | No | Yes |
| Scheduled fight count | derived from active matches/bouts | No | Yes |
| Already matched | derived from active matches/bouts | No | Yes |
| Promoter preferences | event matchmaking settings | No | Yes |

## Delivery checklist

### Phase 1 — participant data and manual event entry

- [x] Add missing fighter and manual-fighter fields.
- [x] Allow event registrations to represent platform or manual fighters.
- [x] Add promoter/manager event-roster UI.
- [x] Add proxy-consent audit fields for represented fighters.
- [x] Preserve and backfill existing registrations.
- [x] Update fighter profile editing and cards.

### Phase 2 — automatic matchmaking

- [x] Persist explainable match suggestions.
- [x] Recalculate suggestions when eligibility, rules, matches, or bouts change.
- [x] Require exact `eligible` status when creating a proposal.
- [x] Include global previous-opponent history.
- [x] Count pending matches and active bouts as assignments.
- [x] Add accept, reject, modify, lock, and regenerate controls.
- [x] Add fighter and authorized-representative confirmations.
- [x] Add realtime dashboard updates.

### Phase 3 — official bout graphics

- [x] Expand bout snapshots with presentation-safe fighter data.
- [x] Create versioned event graphics settings and bout graphic records.
- [x] Generate a draft graphic whenever an official bout is approved or changed.
- [x] Add review and publish controls.
- [x] Add 16:9 venue Screen Mode.
- [x] Add downloadable social and screen assets.
- [x] Upload event logos, backgrounds, and sponsor logos from the operator's device.
- [x] Preview and control the active venue graphic inside the event graphics workspace.
- [x] Open authenticated Screen Mode directly inside Strikers Match without generating a display link.
- [x] Keep previously issued display tokens backward-compatible without exposing token creation in the current operator workflow.

### Phase 4 — hardening

- [ ] Add authorization and RLS tests for every new table and RPC.
- [ ] Add concurrency tests for proposal and bout creation.
- [ ] Verify manual, represented, and self-registered participant workflows.
- [ ] Verify reconnect and last-known-state behavior for Screen Mode.
- [ ] Harden the separate Studio API before exposing it publicly.

### Phase 7 — Guided Promoter/Manager Onboarding + Contextual Help System

- [x] Show a first-login welcome screen only to promoters and managers.
- [x] Replace the long role modal with an eight-step, one-action-at-a-time guide.
- [x] Persist `onboarding_completed`, `onboarding_step`, and `onboarding_dismissed` in the profile.
- [x] Remember the event being configured so the guide resumes on the correct workflow.
- [x] Advance from real milestones: event creation, registration configuration, first participant, official bout, and published graphic.
- [x] Add copy/share controls for the public event-registration link.
- [x] Add a permanent `? Ayuda` launcher with short task-based walkthroughs.
- [x] Add a visible progress indicator and keep the platform usable when the guide is dismissed.
- [x] Allow completed or dismissed users to restart the guide later.
- [x] Open authenticated sequence display mode directly from the final step.

Static verification completed on 2026-09-07: TypeScript, targeted ESLint,
and whitespace validation pass. Local migration/RLS and end-to-end tests remain
open because no Docker-compatible container runtime is installed. Studio hardening is separate
from this workflow and does not change the existing background video.

## Change log

- 2026-09-07: Roadmap created from the approved matchmaking-to-presentation workflow and requested fighter-card fields.
- 2026-09-07: Added canonical platform/manual event participants, eligibility snapshots, consent audit data, and the event roster UI.
- 2026-09-07: Added persisted explainable scoring, assignment/history checks, operator reviews, fighter confirmations, and manager proxy confirmations.
- 2026-09-07: Added official registration-based bouts, generated graphic drafts, publishing/download controls, revocable display tokens, venue sequence mode, and transparent overlay mode.
- 2026-09-07: Added Phase 7 guided promoter/manager onboarding, persistent progress, milestone-based contextual prompts, registration-link sharing, and permanent task-based help.
- 2026-09-07: Replaced operator-facing logo/background/sponsor URL inputs with project-storage uploads, embedded the active screen preview in the graphics workspace, and removed display-link generation from the normal Screen Mode workflow.
