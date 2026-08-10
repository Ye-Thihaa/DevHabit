import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { Loader2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { AppNav } from "@/components/app-nav";
import { BurnoutCard } from "@/components/dashboard/burnout-card";
import { CorrelationsCard } from "@/components/dashboard/correlations-card";
import { DataQualityCard } from "@/components/dashboard/data-quality-card";
import { DescriptiveCard } from "@/components/dashboard/descriptive-card";
import { GithubSyncCard } from "@/components/dashboard/github-sync-card";
import { LagCard } from "@/components/dashboard/lag-card";
import { PredictionCard } from "@/components/dashboard/prediction-card";
import { TrendsCard } from "@/components/dashboard/trends-card";
import { WakatimeSyncCard } from "@/components/dashboard/wakatime-sync-card";
import { WeeklySummaryCard } from "@/components/dashboard/weekly-summary-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTimezoneSync } from "@/hooks/use-timezone-sync";
import type { SummaryStats } from "@/lib/analytics-types";
import { api } from "@convex/_generated/api";

// Staggers each card's entrance so the tab doesn't just pop in as one flat
// block — index-based delay keeps it simple without a JS animation library.
function Reveal({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
    >
      {children}
    </div>
  );
}

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

  // Commit timestamps are bucketed by the developer's clock, not UTC.
  useTimezoneSync();

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
      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
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

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sync">Sync</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Reveal index={0}>
              <BurnoutCard />
            </Reveal>
            <Reveal index={1}>
              <WeeklySummaryCard />
            </Reveal>
          </TabsContent>

          <TabsContent value="sync" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Reveal index={0}>
              <GithubSyncCard />
            </Reveal>
            <Reveal index={1}>
              <WakatimeSyncCard />
            </Reveal>
          </TabsContent>

          <TabsContent value="analytics" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Reveal index={0}>
              <DataQualityCard />
            </Reveal>
            <Reveal index={1}>
              <DescriptiveCard />
            </Reveal>
            <Reveal index={2}>
              <TrendsCard />
            </Reveal>
            <Reveal index={3}>
              <CorrelationsCard />
            </Reveal>
            <Reveal index={4}>
              <LagCard />
            </Reveal>
            <Reveal index={5}>
              <PredictionCard />
            </Reveal>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
