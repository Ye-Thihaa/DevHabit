# Task 3: Burnout Threshold Alerts

**Status: ✅ Done**, simpler than originally scoped.

## What actually got built

- `src/components/dashboard/alert-banner.tsx` — reads the existing
  `api.burnout.getBurnoutRisk` query directly and shows a dismissible
  banner when `level === "high"`. Dismissal is per-day, stored in
  `sessionStorage` (clears when the browser tab/session closes, and a new
  day's still-high score isn't silently suppressed by yesterday's
  dismissal).
- Wired into `src/routes/dashboard.tsx`, above the tabs, so it's visible
  regardless of which tab is active.

## Deviation from the original brief

The brief proposed a new `convex/alerts.js` module and an `alerts` table.
Neither was needed: "is the score high right now" is exactly what
`getBurnoutRisk` already computes and the dashboard already subscribes to
reactively — storing a derived boolean in a table would just be a second
copy of the same fact, with its own staleness problem. The banner reads the
live query directly instead.

## Acceptance criteria (from the original brief)

- ✅ Crossing the high-risk threshold produces a visible dashboard banner.
- ✅ Banner is dismissible per-session.
- ✅ No changes to existing burnout scoring/threshold logic.
