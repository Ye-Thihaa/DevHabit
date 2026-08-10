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
  rule-based score from a recent-vs-prior 14-day window comparison, with
  thresholds in [convex/lib/thresholds.js](convex/lib/thresholds.js).
- **Burnout — plain-language AI assessment** (`getBurnoutAssessment` in
  [convex/burnout.js](convex/burnout.js)): the rule-based score stays the
  source of truth; Claude only narrates it (headline + reasoning +
  suggestions) via the "Explain this in plain language" button on the
  burnout card. Falls back to a mock message without `ANTHROPIC_API_KEY`.
- **WakaTime sync** ([convex/wakatime.js](convex/wakatime.js), [src/components/dashboard/wakatime-sync-card.tsx](src/components/dashboard/wakatime-sync-card.tsx)):
  pulls real time-tracking data in as a source alongside commits/self-reports.
  **Confirmed working end-to-end** as of 2026-08-10 — fixed a Basic-auth
  encoding bug (needed `base64(key + ":")`, not `base64(key)`) plus added a
  `User-Agent` header and proper error surfacing; ingestion log now shows
  successful 30-day syncs.
- **README** ([README.md](README.md)): full local setup instructions
  (Convex, GitHub OAuth + token, optional Anthropic key, WakaTime).
- **Dashboard UX pass**: cards regrouped into **Overview / Sync / Analytics**
  tabs ([src/routes/dashboard.tsx](src/routes/dashboard.tsx)) with a
  staggered fade-in instead of one long single-column scroll of 10 cards.
- **Analytics simplified for non-technical readers**: `CorrelationsCard`,
  `DescriptiveCard`, `LagCard`, `PredictionCard` now lead with a plain-English
  sentence; the r/p-value/R²/sd jargon is tucked behind a "Show the numbers
  behind this" toggle ([src/components/dashboard/technical-details.tsx](src/components/dashboard/technical-details.tsx)),
  nothing removed, just not front-and-center by default.
- **Claude Code ↔ WakaTime integration**: confirmed the official
  `claude-code-wakatime` plugin is installed and sending heartbeats, so
  coding time spent in Claude Code on this repo counts toward WakaTime (and
  from there, into the dashboard).

## Existing dashboard surface

`src/components/dashboard/`: card, correlations-card, data-quality-card,
descriptive-card, github-sync-card, lag-card, prediction-card, trends-card,
weekly-summary-card, burnout-card, wakatime-sync-card, technical-details.

## In progress

- **Tests** for `convex/burnout.js` and `convex/wakatime.js` — no test
  framework exists in the repo yet, so this starts with adding one
  (Vitest) before writing the burnout-scoring and sync-logic test cases.

## Open areas / not yet started

- Cross-source correlation between WakaTime time and burnout score.
- Historical trend charts for burnout over time (currently point-in-time only) — [TASK_1](TASK_1_burnout_trends.md).
- Notifications/alerts when burnout risk crosses a threshold — [TASK_3](TASK_3_alerts_notifications.md).
- Settings UI for configuring/replacing the WakaTime API key per user — [TASK_2](TASK_2_wakatime_settings.md).
- Mobile responsiveness pass on the new tabbed dashboard layout — not verified yet.

## Next steps

See the three task briefs below, split to touch non-overlapping files so
teammates can work in parallel without merge conflicts:

1. [TASK_1_burnout_trends.md](TASK_1_burnout_trends.md)
2. [TASK_2_wakatime_settings.md](TASK_2_wakatime_settings.md)
3. [TASK_3_alerts_notifications.md](TASK_3_alerts_notifications.md)
