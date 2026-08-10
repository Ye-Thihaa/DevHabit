# DevHabit — Progress Report

_Date: 2026-08-10_
_Branch: `feat/burnout-wakatime-tracking`_

## Summary

DevHabit tracks developer coding habits (commits, self-reported logs, WakaTime
time-tracking) and surfaces analytics — trends, correlations, predictions,
data quality, and burnout risk — on a Convex-backed dashboard.

## Completed so far

- **Core scaffolding**: Convex backend (`auth`, `github`, `dailyLogs`,
  `analytics`, `predictions`, `weeklySummary`, `maintenance`, `seed`,
  `migrations`) wired to a React (TanStack Router) frontend dashboard.
- **GitHub OAuth login** via Convex Auth ([convex/auth.config.ts](convex/auth.config.ts), [convex/auth.ts](convex/auth.ts)).
- **Commit data quality fixes**: local-clock bucketing of commit times and
  filtering of generated files from line counts.
- **Self-reported data**: conditioned generated/sample self-reported entries
  on the real commit record so demo data lines up with actual activity.
- **Repo cleanup**: removed leftover Lovable scaffolding; added branching
  rules to `CLAUDE.md`.
- **Burnout risk score** ([convex/burnout.js](convex/burnout.js), [src/components/dashboard/burnout-card.tsx](src/components/dashboard/burnout-card.tsx)):
  computes a burnout indicator from activity patterns and thresholds
  ([convex/lib/thresholds.js](convex/lib/thresholds.js)).
- **WakaTime sync** ([convex/wakatime.js](convex/wakatime.js), [src/components/dashboard/wakatime-sync-card.tsx](src/components/dashboard/wakatime-sync-card.tsx)):
  pulls real time-tracking data in as a source alongside commits/self-reports.

## Existing dashboard surface

`src/components/dashboard/`: card, correlations-card, data-quality-card,
descriptive-card, github-sync-card, lag-card, prediction-card, trends-card,
weekly-summary-card, burnout-card, wakatime-sync-card.

## Open areas / not yet started

- Cross-source correlation between WakaTime time and burnout score.
- Historical trend charts for burnout over time (currently point-in-time only).
- Notifications/alerts when burnout risk crosses a threshold.
- Tests for `convex/burnout.js` and `convex/wakatime.js` logic.
- Settings UI for configuring WakaTime API key / thresholds per user.

## Next steps

See the three task briefs below, split to touch non-overlapping files so
teammates can work in parallel without merge conflicts:

1. [TASK_1_burnout_trends.md](TASK_1_burnout_trends.md)
2. [TASK_2_wakatime_settings.md](TASK_2_wakatime_settings.md)
3. [TASK_3_alerts_notifications.md](TASK_3_alerts_notifications.md)
