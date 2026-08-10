# Task 2: WakaTime Settings UI (API Key & Sync Config)

**Branch**: `feat/wakatime-settings` (off `dev`)

## Goal

WakaTime sync ([convex/wakatime.js](convex/wakatime.js), [src/components/dashboard/wakatime-sync-card.tsx](src/components/dashboard/wakatime-sync-card.tsx))
exists but there's no UI for a user to configure their own WakaTime API key
or sync preferences. Add a settings page/section for this.

## Scope (new files only)

- **New**: `src/routes/settings.tsx` — new route with a form for entering/
  updating a WakaTime API key and sync frequency preference.
- **New**: `convex/userSettings.js` — mutations/queries to store per-user
  WakaTime API key (store securely, never log it) and preferences.
- **Schema**: add a `userSettings` table to [convex/schema.js](convex/schema.js)
  — same as Task 1, append as an additive block at the end of the file to
  reduce merge conflicts; coordinate ordering with teammates before merging.
- **Nav link**: add a "Settings" link in [src/routes/__root.tsx](src/routes/__root.tsx)
  (small, isolated addition).

## Out of scope

- Do not modify `convex/wakatime.js` sync logic itself or
  `wakatime-sync-card.tsx` — just add a way to configure what those already
  use.

## Acceptance criteria

- User can enter and save a WakaTime API key from `/settings`.
- Key is never displayed in plaintext after saving (masked).
- Existing WakaTime sync card continues to work unchanged.
