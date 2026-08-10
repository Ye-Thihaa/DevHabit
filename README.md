# DevHabit

Tracks developer coding habits — commits (GitHub), time spent (WakaTime), and
self-reported daily logs — and surfaces descriptive stats, correlations,
predictions, data-quality reporting, and a burnout risk score on a dashboard.

Stack: TanStack Start (React) frontend + Convex (backend/DB/auth), GitHub
OAuth login via `@convex-dev/auth`.

## Prerequisites

- Node.js 20+
- A [Convex](https://convex.dev) account (free tier is fine)
- A GitHub account to create an OAuth App and a personal access token

## 1. Install dependencies

```bash
npm install
```

## 2. Set up Convex

This project uses Convex for the database, server functions, and auth. Log
in and create/link a deployment:

```bash
npx convex dev
```

The first run will prompt you to log in and either create a new Convex
project or link to an existing one. Leave this command running in a terminal
— it watches `convex/` and pushes your functions/schema live, and it writes
`.env.local` with `CONVEX_URL`/`CONVEX_DEPLOYMENT` for the frontend to use.

## 3. Configure GitHub OAuth login

Auth is handled by `@convex-dev/auth` with GitHub as the only provider
([convex/auth.ts](convex/auth.ts)).

1. Create a GitHub OAuth App: https://github.com/settings/developers →
   "New OAuth App".
   - Homepage URL: `http://localhost:8080`
   - Authorization callback URL: use the URL Convex prints when you run
     `npx convex dev` (or check `npx convex env get CONVEX_SITE_URL`), e.g.
     `https://<your-deployment>.convex.site/api/auth/callback/github`
2. Set the resulting client ID/secret on your Convex deployment:

```bash
npx convex env set AUTH_GITHUB_ID <client-id>
npx convex env set AUTH_GITHUB_SECRET <client-secret>
```

## 4. Configure GitHub data sync

Commit/PR/review history is pulled server-side using a personal access
token, separate from OAuth login ([convex/github.js](convex/github.js)).

1. Create a classic PAT at https://github.com/settings/tokens with
   `public_repo` and `read:user` scopes.
2. Set it on Convex:

```bash
npx convex env set GITHUB_TOKEN <token>
```

## 5. Optional: AI-generated weekly summaries

[convex/weeklySummary.js](convex/weeklySummary.js) uses the Anthropic API if
configured. Without this, the weekly summary card simply won't generate
text.

```bash
npx convex env set ANTHROPIC_API_KEY <key>
```

## 6. WakaTime sync (per-user, no setup needed here)

WakaTime time-tracking is opt-in per user, not an env var: once signed in,
each user pastes their own key (from
https://wakatime.com/settings/api-key) into the "WakaTime ingestion" card on
the dashboard.

## 7. Run the app

With `npx convex dev` still running in one terminal, start the frontend in
another:

```bash
npm run dev
```

The app runs at http://localhost:8080. Sign in with GitHub, then use the
dashboard cards to sync GitHub/WakaTime data and log daily entries.

## Other scripts

```bash
npm run build     # production build
npm run lint       # eslint
npm run format     # prettier --write .
```

## Project structure

- `convex/` — schema, queries/mutations/actions, split by data provenance
  (self-reported vs. measured vs. sync audit — see the comment atop
  [convex/schema.js](convex/schema.js))
- `src/routes/` — TanStack Router pages (`login`, `dashboard`, `log`)
- `src/components/dashboard/` — one card per dashboard feature

See [CLAUDE.md](CLAUDE.md) for branching rules and
[PROGRESS_REPORT.md](PROGRESS_REPORT.md) for current project status.
