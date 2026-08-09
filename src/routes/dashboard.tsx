import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

import { AppNav } from "@/components/app-nav";
import { CorrelationsCard } from "@/components/dashboard/correlations-card";
import { GithubSyncCard } from "@/components/dashboard/github-sync-card";
import { PredictionCard } from "@/components/dashboard/prediction-card";
import { TrendsCard } from "@/components/dashboard/trends-card";
import { WeeklySummaryCard } from "@/components/dashboard/weekly-summary-card";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — devhabit" },
      {
        name: "description",
        content:
          "Commit sync, weekly AI summaries, predictions, trend charts and a correlation matrix across your logged coding habits.",
      },
      { property: "og:title", content: "Dashboard — devhabit" },
      {
        property: "og:description",
        content: "Trends, correlations and predictions across your logged coding habits.",
      },
    ],
  }),
  component: Dashboard,
});

function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function Dashboard() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated } = useConvexAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  const last7 = useQuery(
    api.dailyLogs.getLogsInRange,
    isAuthenticated ? { startDate: daysAgoStr(6), endDate: daysAgoStr(0) } : "skip",
  );

  const stats = last7
    ? [
        {
          label: "Coding hours (7d)",
          value: last7.reduce((s: number, e: Doc<"dailyLogs">) => s + e.codingHours, 0).toFixed(1),
        },
        {
          label: "Commits (7d)",
          value: last7.reduce((s: number, e: Doc<"dailyLogs">) => s + e.githubCommits, 0),
        },
        {
          label: "Avg sleep (7d)",
          value: last7.length
            ? (
                last7.reduce((s: number, e: Doc<"dailyLogs">) => s + e.sleepHours, 0) / last7.length
              ).toFixed(1)
            : "0.0",
        },
        { label: "Days logged (7d)", value: last7.length },
      ]
    : null;

  if (isLoading || !isAuthenticated) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <h1 className="text-2xl font-semibold sm:text-3xl">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything derived from your logs — synced commits, weekly reads, and the statistics.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(stats ?? [null, null, null, null]).map((s, i) => (
            <div
              key={s ? s.label : i}
              className="rounded-xl border border-border bg-card p-4 shadow-card"
            >
              <p className="text-xs text-muted-foreground">{s ? s.label : "—"}</p>
              <p className="stat-num mt-1 text-2xl font-semibold">{s ? s.value : "…"}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-5">
          <GithubSyncCard />
          <WeeklySummaryCard />
          <PredictionCard />
          <TrendsCard />
          <CorrelationsCard />
        </div>
      </main>
    </div>
  );
}
