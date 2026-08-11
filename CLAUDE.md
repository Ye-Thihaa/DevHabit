# Branching rules

- `main` is production. Never commit or push directly to `main` — it is only
  updated when merging `dev` in for a release.
- `dev` is the trunk for ongoing development. Day-to-day work and merges from
  feature branches land here first.
- New features/changes are built on a branch named `feat/<featureName>`,
  branched off `dev`, then merged back into `dev` (e.g. via PR) when done.
- Never force-push, rewrite history, or delete `main`/`dev` without the user
  explicitly asking for that specific action.
