# Habit Track

Build the frontend UI for a "Coding Habits & Productivity Tracker" — a web app where a developer logs daily habits and sees how they relate to their coding output. This is a UI-only build: use mock/placeholder data everywhere, don't set up Supabase or any backend — I already have a working backend I'll connect afterward. The login screen should also be UI-only (no real authentication logic) — I'll wire it up separately.

Four views total:

## 1. Landing page

This is the first thing visitors see. Hero section with the app name, a short one-line tagline (e.g. "Track your coding habits. See what actually moves the needle."), a brief description, and a primary "Get Started" / "Log In" button. Below the hero, a features section with short cards highlighting: daily habit logging, GitHub commit sync, AI-generated weekly summaries, correlation analysis, and simple predictions. Clean footer. This page should feel like a real product marketing page, not a placeholder.

## 2. Login page

A centered card with: email + password fields, a "Sign In" button, a divider ("or"), and a "Continue with GitHub" button (with the GitHub icon). Include a small "Don't have an account? Sign up" link (can go nowhere / same page). None of this needs to actually authenticate anything — it's UI only, but should look and feel like a real, polished auth screen. On submit, just navigate into the app.

## 3. Daily Log page

A form to record one day's entry, with these fields:

- Date (date picker, defaults to today)

- Coding Hours (number)

- Sleep Hours (number)

- Coffee Intake, in cups (number)

- GitHub Commits (number)

- AI Tool Usage, in minutes (number)

- Problems Solved (number)

- Task Difficulty (1–5 scale — dropdown or segmented control)

- Experience Level (1–5 scale)

- Programming Score (1–10 scale)

Include inline validation states (required field, invalid number) and a clear success/error message area after submit. A "Save Log" button.

## 4. Dashboard page

Stack these sections vertically, each in its own card:

1. **GitHub Sync** — a small card: if no GitHub username is linked, show a text input + "Save" button; if linked, show "Linked GitHub account: <username>" plus a date picker and a "Sync Commits from GitHub" button with a loading state.

2. **Weekly AI Summary** — a card with a "Generate Weekly Summary" button (loading state while generating) that reveals a paragraph of AI-generated text below it.

3. **Prediction** — a card with three controls in a row: a "predictor field" dropdown (choose from the same fields as the log form), a number input for a planned value, an "output field" dropdown, and a "Predict" button. Below, show the result: an estimated number, plus small caption text with sample size, an R² value, and a caveat that this is a rough estimate from limited data, not a guarantee.

4. **Trends** — a card with a date-range selector (Last 7 / 30 / 90 days), a multi-select of which fields to plot (chips or checkboxes, several selected by default), and a line chart area showing the selected fields over time.

5. **Correlations** — a card showing a 9x9 correlation heatmap/table across all the numeric fields listed above (color-coded from strongly negative to strongly positive), with a caption showing how many days of data it's based on.

App navigation: once logged in, a persistent top nav bar with the app name/logo, and tabs/links for "Daily Log" and "Dashboard", plus a user avatar menu on the right (mock — no real session).

## Style

Clean, modern developer-tool aesthetic — think Linear or Vercel dashboard, not corporate SaaS. Good use of whitespace, subtle borders/shadows on cards, a readable monospace or geometric sans font for numbers/stats. Support both light and dark mode. Fully responsive down to mobile width.

Use realistic mock data (a week or two of varied daily entries) so every section renders with something to look at, not empty states.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/259f90b9-7a5f-4f91-8a59-e1481bc6b868).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
