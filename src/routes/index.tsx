import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BrainCircuit,
  ChartSpline,
  GitBranch,
  NotebookPen,
  Sparkles,
  Terminal,
  TrendingUp,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "devhabit — Coding Habits & Productivity Tracker" },
      {
        name: "description",
        content:
          "Log sleep, coffee, focus hours and AI usage, sync your GitHub commits, and see which habits actually move your coding output.",
      },
      { property: "og:title", content: "devhabit — Coding Habits & Productivity Tracker" },
      {
        property: "og:description",
        content:
          "Log daily habits, sync commits, and get correlations, weekly AI summaries and rough predictions for your coding output.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: NotebookPen,
    title: "Daily habit logging",
    body: "One short form a day: sleep, coffee, focus hours, difficulty, problems solved. Thirty seconds, no dashboards to configure.",
  },
  {
    icon: GitBranch,
    title: "GitHub commit sync",
    body: "Link your handle once and pull real commit counts per day, so your output metric isn't something you have to guess at.",
  },
  {
    icon: Sparkles,
    title: "AI weekly summaries",
    body: "A plain-language read on your week: what changed, what held, and one experiment worth running next week.",
  },
  {
    icon: ChartSpline,
    title: "Correlation analysis",
    body: "A full matrix across every field you track, so you can see whether coffee or sleep is really carrying your good days.",
  },
  {
    icon: TrendingUp,
    title: "Simple predictions",
    body: "Pick an input and a planned value, get an estimated output with sample size and R² attached. Honest numbers, not oracle claims.",
  },
  {
    icon: BrainCircuit,
    title: "Built for one person",
    body: "No teams, no velocity charts, no standups. Just your own data, kept small enough to actually read.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <Terminal className="size-4" />
            </span>
            <span className="font-semibold tracking-tight">devhabit</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:py-28">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" />
            14 days logged · 78 commits this week
          </p>
          <h1 className="text-4xl font-bold sm:text-6xl">
            Track your coding habits.
            <br />
            <span className="text-muted-foreground">See what actually moves the needle.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            devhabit pairs a thirty-second daily log with your real GitHub activity, then does the
            boring statistics for you — correlations, trends, and a weekly read on what changed.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/login">
                Get started <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-4 font-mono text-xs text-muted-foreground">
            Free while it's just you. No credit card.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-2xl font-semibold sm:text-3xl">Everything in one loop</h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Log, sync, read. The whole product is that loop — nothing else to maintain.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-elevated"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground">
                <f.icon className="size-4" />
              </span>
              <h3 className="mt-4 font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-8 sm:flex sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded bg-primary text-primary-foreground">
              <Terminal className="size-3" />
            </span>
            <span className="truncate font-mono text-xs text-muted-foreground">
              devhabit — built for one developer at a time
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
            <Link to="/login" className="hover:text-foreground">
              Log in
            </Link>
            <Link to="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
