# Task 3: Burnout Threshold Alerts

**Branch**: `feat/burnout-alerts` (off `dev`)

## Goal

When a user's burnout risk score crosses a configured threshold
([convex/lib/thresholds.js](convex/lib/thresholds.js)), surface an
in-app alert/banner so it isn't only visible by opening the burnout card.

## Scope (new files only)

- **New**: `convex/alerts.js` — a Convex module that checks the latest
  burnout score against thresholds (import read-only from
  `convex/lib/thresholds.js` and `convex/burnout.js`, don't modify them)
  and returns/stores active alerts.
- **Schema**: add an `alerts` table to [convex/schema.js](convex/schema.js)
  — additive block at the end of the file, same coordination note as the
  other tasks.
- **New**: `src/components/dashboard/alert-banner.tsx` — a banner component
  shown at the top of the dashboard when an active alert exists.
- **Route wiring**: add the banner to [src/routes/dashboard.tsx](src/routes/dashboard.tsx)
  — one small, isolated addition (import + one JSX line), same pattern as
  Task 1's addition to keep the diffs non-overlapping.

## Out of scope

- Do not modify `convex/burnout.js`, `convex/lib/thresholds.js`, or
  `burnout-card.tsx`.

## Acceptance criteria

- Crossing the high-risk threshold produces a visible dashboard banner.
- Banner is dismissible per-session.
- No changes to existing burnout scoring/threshold logic.

## Merge-conflict note for all three tasks

All three tasks append to `convex/schema.js` and `src/routes/dashboard.tsx`.
To keep conflicts trivial:
- Schema additions: each task adds its table as a new, clearly separated
  block at the very end of the file — never edit existing table definitions.
- Dashboard route additions: each task adds exactly one import line and one
  JSX line, in a distinct location (e.g. comment markers per task) so git
  can auto-merge them.
Whoever merges second/third should expect a small, easy manual resolution
on these two files, not by design that we're overlapping.
