# Task 2: WakaTime Settings UI (API Key & Sync Config)

**Status: ✅ Done**, with one deliberate deviation from the original plan
below.

## What actually got built

- `convex/users.js` — new `clearWakatimeApiKey` mutation (the existing
  `setWakatimeApiKey` already covered create/replace via upsert).
- `src/routes/settings.tsx` — new page: masked key display, "Replace key",
  and "Remove" (with a confirm step before it actually deletes).
- `src/components/app-nav.tsx` — "Settings" nav link.
- `src/components/dashboard/wakatime-sync-card.tsx` — once a key is saved,
  it now links to Settings for replace/remove instead of being a dead end.

## Deviation from the original brief

The original brief proposed a new `userSettings` table with a "sync
frequency preference" field. That turned out to be unnecessary:

- The WakaTime key already lives on the `users` table
  (`users.wakatimeApiKey`) — adding a second table for the same value would
  just be indirection.
- "Sync frequency" became moot once the auto-sync cron
  (`convex/crons.js`, every 20 minutes for every connected user) shipped as
  part of the Today-card work — there's no per-user setting to configure,
  it's just always on once connected.

So Settings manages the one thing that actually needed managing — the key
itself — rather than a speculative preferences table.
