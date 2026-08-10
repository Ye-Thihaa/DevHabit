# Task 1: Burnout Score History & Trend Chart

**Branch**: `feat/burnout-trends` (off `dev`)

## Goal

The burnout card ([src/components/dashboard/burnout-card.tsx](src/components/dashboard/burnout-card.tsx))
currently shows a single point-in-time score. Add historical tracking so
users can see how burnout risk changes week over week.

## Scope (new files only — avoid touching shared files)

- **New**: `convex/burnoutHistory.js` — a Convex query/mutation module that
  snapshots the burnout score (reuse the calculation in
  [convex/burnout.js](convex/burnout.js) as a read-only import, don't modify it)
  into a new table.
- **Schema**: add a new table `burnoutHistory` to [convex/schema.js](convex/schema.js)
  — coordinate timing with teammates since this file is shared; add your
  table as a separate, additive block at the end of the file to minimize
  diff overlap.
- **New**: `src/components/dashboard/burnout-trend-card.tsx` — a new card
  component rendering a line/sparkline chart of burnout score over time
  (reuse existing chart patterns from [src/components/dashboard/trends-card.tsx](src/components/dashboard/trends-card.tsx)
  for consistency, but don't edit that file).
- **Route wiring**: add the new card to [src/routes/dashboard.tsx](src/routes/dashboard.tsx)
  — this file will be touched by other tasks too, so make a small, isolated
  addition (one import + one JSX line) to reduce conflict surface.

## Out of scope

- Do not modify `convex/burnout.js`, `convex/wakatime.js`, or
  `burnout-card.tsx` — those are owned by other tasks/already done.

## Acceptance criteria

- A scheduled or on-demand snapshot mechanism records burnout score history.
- New card shows a trend line for at least the last 8 weeks.
- No changes to existing burnout calculation logic.
