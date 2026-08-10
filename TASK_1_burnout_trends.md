# Task 1: Burnout Score History & Trend Chart

**Status: ✅ Done** (2026-08-10, on `feat/burnout-wakatime-tracking` directly
rather than a separate teammate branch — see PROGRESS_REPORT.md).

## What actually got built

- `convex/schema.js` — new `burnoutHistory` table (userId, date, score,
  level, sampleSize, ranAt).
- `convex/burnout.js` — the scoring logic was factored out into an exported
  `computeBurnoutRisk(ctx, userId)` so it can be reused outside a
  signed-in-user query context.
- `convex/burnoutHistory.js` — `snapshotAllUsers` (internal mutation, called
  daily by a cron) and `getBurnoutHistory` (public query, last N days).
- `convex/crons.js` — daily snapshot at 23:50 UTC.
- `src/components/dashboard/burnout-trend-card.tsx` — recharts line chart,
  dashed reference lines at the 33/66 thresholds, dot color per day's risk
  level. Wired into the Overview tab.
- Bonus (folds in the "cross-source correlation" open item too):
  `burnoutHistory` is joined into `analytics.buildDataset` as a new
  `burnoutScore` field, so it's usable in the Correlations/Lag/Prediction
  cards like any other field — no separate feature needed for that.
- Tests: `convex/burnoutHistory.test.js` (6 cases — insufficient-data skip,
  score matches the live query, upsert-not-duplicate, sort order, cross-user
  isolation).

## Known limitation

History only exists from the day this shipped forward — there's no
backfill, so the trend chart needs a few real days to accumulate before it
shows a line (handled gracefully with a "not enough history yet" state).
