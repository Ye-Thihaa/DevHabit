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
- **Tests**: Vitest + `convex-test` added (none existed before). 27 tests
  covering `getBurnoutRisk`/`getBurnoutAssessment`, WakaTime sync (auth
  encoding, upserts, the 30-day cap, both failure paths), the session-length
  merge logic, and the coding-hours source-priority logic below. `npm test`.
- **Session length**: new `wakatimeDaily.longestSessionMinutes`, pulled from
  WakaTime's Durations API and merged into one "sitting" (gaps under 15 min
  don't count as a break) — slots into the existing Correlations/Lag/
  Prediction cards as a normal field, no new UI needed.
- **New-user cold start**: added a live **Today** ring
  ([today-coding-card.tsx](src/components/dashboard/today-coding-card.tsx),
  first card on the Overview tab) showing coding hours so far today against
  the user's own trailing-30-day average once they have 5+ days of one, or a
  neutral 4h reference before that — so day-one users get something
  meaningful instead of empty 30/90-day charts.
- **WakaTime auto-sync cron** ([convex/crons.js](convex/crons.js)): every 20
  minutes, syncs the last 2 days for every connected user, so the Today ring
  (and everything else) updates without a manual "Sync" click.
- **Fixed a real bug**: WakaTime's summaries endpoint returns
  `codingSeconds: 0` for every day in range, including days before the
  plugin was installed — `buildDataset` (and `burnout.js`) were treating
  that as a confident zero and overriding real self-reported history with
  it. A zero now falls back to self-reported instead. New
  `codingHoursSource` field makes the resolved source explicit.
- **Daily Log form**: once a user connects WakaTime, the Coding Hours field
  is removed from the form entirely (schema/mutation made it optional)
  instead of asking for something the app now measures itself; users
  without WakaTime keep the field as before.

## Existing dashboard surface

`src/components/dashboard/`: card, correlations-card, data-quality-card,
descriptive-card, github-sync-card, lag-card, prediction-card, trends-card,
weekly-summary-card, burnout-card, wakatime-sync-card, technical-details,
today-coding-card.

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
