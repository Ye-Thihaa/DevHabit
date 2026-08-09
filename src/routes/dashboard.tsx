import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

import { AppNav } from "@/components/app-nav";
import { CorrelationsCard } from "@/components/dashboard/correlations-card";
import { DataQualityCard } from "@/components/dashboard/data-quality-card";
import { DescriptiveCard } from "@/components/dashboard/descriptive-card";
import { GithubSyncCard } from "@/components/dashboard/github-sync-card";
import { LagCard } from "@/components/dashboard/lag-card";
import { PredictionCard } from "@/components/dashboard/prediction-card";
import { TrendsCard } from "@/components/dashboard/trends-card";
import { WeeklySummaryCard } from "@/components/dashboard/weekly-summary-card";
import type { SummaryStats } from "@/lib/analytics-types";
import { api } from "@convex/_generated/api";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — devhabit" },
      {
        name: "description",
        content:
          "GitHub ingestion, descriptive statistics, correlations with significance, lagged effects, predictions and a data-quality report across your coding habits.",
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

function Dashboard() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated } = useConvexAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  const summary: SummaryStats | null | undefined = useQuery(
    api.analytics.getSummaryStats,
    isAuthenticated ? { days: 7 } : "skip",
  );

  const stats = summary
    ? [
        { label: "Coding hours (7d)", value: summary.codingHours.toFixed(1) },
        { label: "Commits (7d)", value: String(summary.commits) },
        {
          label: "Avg sleep (7d)",
          value: summary.avgSleep === null ? "—" : summary.avgSleep.toFixed(1),
        },
        { label: "Days logged (7d)", value: `${summary.daysLogged}/7` },
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
          Commits, pull requests and reviews are measured from the GitHub API. Sleep, coffee, focus
          and self-ratings come from your daily log. The analysis keeps the two apart.
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

        {summary && summary.seededDays > 0 && (
          <p className="mt-3 rounded-lg border border-chart-5/40 bg-chart-5/10 px-3 py-2 text-xs">
            {summary.seededDays} of the last 7 days are generated seed data, not real entries.
          </p>
        )}

        <div className="mt-6 space-y-5">
          <GithubSyncCard />
          <DataQualityCard />
          <DescriptiveCard />
          <TrendsCard />
          <CorrelationsCard />
          <LagCard />
          <PredictionCard />
          <WeeklySummaryCard />
        </div>
      </main>
    </div>
  );
}
