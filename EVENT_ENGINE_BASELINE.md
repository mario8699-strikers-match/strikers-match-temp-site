# Event Engine Baseline

Recorded: 2026-08-17

## Authoritative Application Boundary

The root Next.js and Supabase application is the authoritative Strikers Match marketplace and event engine.

It owns:

- User and fighter identities
- Events
- Event applications and registrations
- Eligibility
- Fight requests and pairing proposals
- Bouts, mats, order, and results

The `apps/web` and `apps/api` Strikers Match Studio workspace must consume authoritative marketplace IDs through a later integration contract. It must not create a second authoritative fighter, event, or bout identity.

## Existing Critical Flows

The following behavior must remain operational while the event engine is introduced:

1. Fighter creates and updates a fighter profile.
2. Fighter applies to a published event.
3. Promoter accepts or declines the application.
4. Fighter registers for the event.
5. Fighter marks external payment as submitted.
6. Promoter confirms payment.
7. Promoter or manager sends a fight request.
8. Fighter accepts or declines a fight request.
9. Promoter proposes a pairing between two paid fighters.
10. Each fighter accepts or declines their side of the pairing.
11. Reliability changes are recorded once per applicable action.

## Verification Baseline

### TypeScript

Command:

```text
npx tsc --noEmit --pretty false
```

Status at baseline: passing.

### ESLint

Command:

```text
npm run lint
```

Status at baseline: failing with 40 errors and 8 warnings in pre-existing files and rules.

Representative existing failures:

- Internal navigation uses plain anchor elements in several pages.
- Existing effects synchronously set state under the current React lint rules.
- Existing code mutates `window.location.href` under the immutability rule.
- `api/waitlist.js` uses CommonJS `require`.
- Existing `IdleTimeout` code violates purity/declaration-order rules.

Event-engine changes must pass targeted lint. Repository-wide lint cannot be used as a new-change gate until the baseline errors are resolved separately.

### Automated Tests

Status at baseline: no Jest, Vitest, Playwright, or other application test suite is configured.

No dependency may be installed solely to create the Phase 0 baseline without explicit approval. Pure domain behavior should therefore be kept in dependency-free modules that can be tested once the project test runner is selected.

### Database Tooling

The Supabase CLI and PostgreSQL client are available locally. Applying a migration requires an explicit target environment and database credentials; migrations must not be applied to an unknown or production database during local validation.

## Existing Schema Risks

- `event_applications` and `event_registrations` overlap without a formal link.
- `matches` represents proposals, not permanent event-day bouts.
- A fighter can be assigned to multiple active matches for one event.
- The unique pair constraint prevents clean re-proposal after cancellation.
- Fighter match-update RLS is row-wide rather than limited to the acting fighter's response.
- The current recommendation engine ranks fighters against an event rather than comparing two fighters.
- The TypeScript Fighter model used `experience_level` without a tracked migration creating the column.
- Studio defines separate event, fighter, and bout tables that are not integrated with marketplace identities.

## UI Baseline

New event-engine UI must follow the existing brand system:

- Barlow and Barlow Condensed typography
- White, carbon black, zinc, and Strikers red surfaces
- Square edges
- Simple borders and compact status labels
- Typography-led hierarchy
- No gradients
- No decorative icons
- No emojis
- No AI-style glow, glass, oversized rounding, floating decoration, or ornamental effects

Responsive requirements are defined in `EVENT_ENGINE_ROADMAP.md` and apply to loading, empty, error, conflict, and success states as well as primary content.
