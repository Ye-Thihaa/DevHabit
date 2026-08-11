# DevHabit — Progress Report

_Date: 2026-08-12_
_Branch: `dev`_

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
- **New-user cold start**: added a **Today** card
  ([today-coding-card.tsx](src/components/dashboard/today-coding-card.tsx),
  first card on the Overview tab) showing coding hours so far today — as a
  digital-clock-style HH:MM readout — against the user's own trailing-30-day
  average once they have 5+ days of one, or a neutral 4h reference before
  that — so day-one users get something meaningful instead of empty
  30/90-day charts.
- **WakaTime auto-sync cron** ([convex/crons.js](convex/crons.js)): every 20
  minutes, syncs the last 2 days for every connected user, so the Today card
  (and everything else) refreshes without a manual "Sync" click. Not a
  live-ticking stopwatch — the number only changes when a sync writes new
  data, so it can lag up to ~20 minutes; confirmed as an acceptable
  trade-off (see conversation) rather than building a sub-minute sync or a
  client-side extrapolated tick.
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
- **[TASK_1](TASK_1_burnout_trends.md) — Burnout trend history**: new
  `burnoutHistory` table, snapshotted daily by a cron
  (`convex/burnoutHistory.js`), charted in `burnout-trend-card.tsx`. Also
  joined into `analytics.buildDataset` as a `burnoutScore` field, which
  resolves the "cross-source correlation" open item too — it's now just
  another field in the existing Correlations/Lag/Prediction cards.
- **[TASK_2](TASK_2_wakatime_settings.md) — WakaTime key management**: new
  `/settings` page (masked key, replace, remove with confirm), linked from
  the nav and from the WakaTime sync card. Built leaner than originally
  scoped — no new `userSettings` table, since the key already lives on
  `users` and "sync frequency" became moot once the auto-sync cron shipped.
- **[TASK_3](TASK_3_alerts_notifications.md) — High-burnout-risk alert**:
  dismissible banner on the dashboard when risk is "high", reading the
  existing `getBurnoutRisk` query directly rather than a new alerts table.
  Dismissal is per-day via sessionStorage.
- **Mobile responsiveness**: checked at 375px — nav, stat tiles, tabs, and
  card grids all reflow to a single column correctly.

## Since then (2026-08-11)

- **LLM provider fallback** ([convex/lib/llm.js](convex/lib/llm.js)): both AI
  features (weekly summary, burnout assessment) each hard-coded an Anthropic
  fetch. They now share one chain — **Anthropic → Groq → mock**. A billing or
  quota rejection (401/402/429/5xx, or a failed request) moves to the next
  provider; a refusal or an unparseable reply stops the chain, because that's
  a real answer about the prompt rather than an outage. `GROQ_API_KEY` is set
  on the deployment and confirmed generating real summaries. The burnout
  **score** stays rule-based and never depends on an LLM.
- **Default form controls replaced**: number fields used the browser's own
  spinner arrows and checkboxes used `accent-color`, both of which render
  differently per platform. Three components replace them app-wide —
  [NumberStepper](src/components/ui/number-stepper.tsx) (−/+ buttons, native
  spinners hidden in `styles.css`, which also stops a stray scroll from
  editing a logged number), [CheckToggle](src/components/ui/check-toggle.tsx),
  and [Segmented](src/components/ui/segmented.tsx).
- **Correlations readability**: the card opened with an 880px grid of 100
  r-values — that answers "what is the number for X and Y" while the reader
  is still asking "what did you find". It now leads with the significant
  pairs ranked strongest-first as sentences; the grid and every number behind
  it moved under the existing disclosure.
- **Sidebar shell** ([app-shell.tsx](src/components/app-shell.tsx),
  [app-sidebar.tsx](src/components/app-sidebar.tsx)): the top nav carried
  route links while the dashboard's views sat separately in a tab strip, so
  "where am I" was split across two controls. Both now live in one left rail,
  collapsible to a 72px icon rail (persisted in localStorage, read in an
  effect so hydration doesn't break) and shown as a sheet under `lg`. The
  dashboard views became `?view=` links, so the back button works and a view
  can be linked to. `app-nav.tsx` is deleted.
- **Logging streak** ([convex/streaks.js](convex/streaks.js),
  [streak-card.tsx](src/components/dashboard/streak-card.tsx)): every other
  statistic degrades quietly when logging stops, and nothing surfaced that
  until a card went blank. Current/longest streak plus a 182-day heatmap.
  Seeded rows never count. An unlogged *today* doesn't break the run (the day
  hasn't ended); only a gap before yesterday does. Heatmap shades against the
  90th-percentile day, not the maximum, so one crunch day doesn't flatten
  everything else.
- **CSV export** ([src/lib/csv.ts](src/lib/csv.ts),
  [export-button.tsx](src/components/dashboard/export-button.tsx)): downloads
  the joined dataset the statistics are computed from, so a spreadsheet
  number can be checked against the dashboard. Values Excel would execute as
  a formula are prefixed; a BOM keeps non-ASCII readable there; a blank cell
  means no data rather than zero.
- **Daily goals** ([goals-section.tsx](src/components/goals-section.tsx)):
  optional per-day targets on the user record, next to the WakaTime key.
  Nothing in the analysis reads them — they only change what the Today card
  compares against, so an ambitious target can never bend a correlation. A
  goal outranks the personal average once set.
- **One shared date range**: Descriptive and Trends each owned a range
  picker, so the two halves of the analytics view could silently disagree
  about the window. One control in the header, carried in `?range=`.
- **Deployment retargeted to Vercel**: `vite.config.ts` was a one-line
  wrapper around `@lovable.dev/vite-tanstack-config`, which bundled the
  plugins and defaulted Nitro to the **Cloudflare** preset with no way to
  change it. The plugins are now spelled out and the preset is `vercel`
  (overridable via `NITRO_PRESET`). The Lovable dependency, its `bunfig.toml`
  entries, and the `@Lovable` Twitter meta tag are gone. New favicon
  (`.ico` + `.svg`) matching the sidebar brand mark. See the README for the
  deploy steps.
- **Tests**: 70 total (33 → 70).

## Since then (2026-08-12)

- **LeetCode sync** ([convex/leetcode.js](convex/leetcode.js)): `problemsSolved`
  moves from self-reported to measured, the same shift WakaTime made for
  `codingHours`. Per-user public username (`users.leetcodeUsername`, no key —
  the profile data is public), settings section, dashboard sync card, and a
  daily cron alongside the burnout snapshot.
  **The one real limitation**: LeetCode publishes no per-day history of solved
  problems, only running totals. Every daily figure here comes from
  snapshotting the totals once a day and differencing consecutive snapshots —
  which means nothing can be back-filled, the first-ever snapshot has no delta
  at all (never a fabricated 0), and a missed day produces one delta spanning
  the gap, flagged with `daysSincePrevious` so it's never mistaken for a single
  day's work and never summed into a window total as if it were.
  `analytics.buildDataset` prefers LeetCode's figure only when that day's
  snapshot differenced cleanly (`daysSincePrevious === 1`); otherwise it falls
  back to self-reported, exactly like a WakaTime zero does.
  `dailyLogs.problemsSolved` is now optional and the daily-log form stops
  asking for it once connected, same as `codingHours` for WakaTime.
- **Tests**: 104 total (70 → 104).

## Existing dashboard surface

`src/components/dashboard/`: card, correlations-card, data-quality-card,
descriptive-card, github-sync-card, lag-card, prediction-card, trends-card,
weekly-summary-card, burnout-card, burnout-trend-card, wakatime-sync-card,
leetcode-sync-card, technical-details, today-coding-card, alert-banner,
streak-card, export-button.

## Open areas / not yet started

[TASK_1](TASK_1_burnout_trends.md), [TASK_2](TASK_2_wakatime_settings.md) and
[TASK_3](TASK_3_alerts_notifications.md) are all done. Possible next work,
none currently planned:

- **Nothing in the 2026-08-11 or 2026-08-12 batches has been verified in a
  browser by a signed-in user.** Both typecheck, build, and pass their tests,
  but the streak card, CSV download, goals form, collapsible sidebar, header
  range picker, and now the LeetCode settings/sync flow have only been
  exercised by unit tests and an unauthenticated console check.
- Backfilling burnout history for dates before that feature shipped — the
  underlying logs/commits still exist, so a one-time script could compute
  historical scores.
- A "days connected" indicator so WakaTime/GitHub/LeetCode coverage gaps are
  more visible at a glance.
- The repo-wide CRLF lint failure (5000+ `prettier/prettier` errors from line
  endings, present before any of this work) is still unaddressed; `npm run
  lint` fails because of it.
- Goals exist for sleep and commits but only the coding-hours goal is read by
  a card so far.
- LeetCode's profile GraphQL endpoint is unofficial — no key, no login, but it
  can change shape or rate-limit without notice. Every failure is caught and
  recorded in `syncRuns` rather than thrown from the cron, but a schema change
  on LeetCode's side would surface as a silent-looking sync failure until
  someone checks the sync-run history.
