import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { Loader2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import type { DashboardView } from "@/components/app-sidebar";
import { AccuracyCard } from "@/components/dashboard/accuracy-card";
import { AchievementsCard } from "@/components/dashboard/achievements-card";
import { AlertBanner } from "@/components/dashboard/alert-banner";
import { BurnoutCard } from "@/components/dashboard/burnout-card";
import { BurnoutTrendCard } from "@/components/dashboard/burnout-trend-card";
import { CommitCoachCard } from "@/components/dashboard/commit-coach-card";
import { CorrelationsCard } from "@/components/dashboard/correlations-card";
import { DataQualityCard } from "@/components/dashboard/data-quality-card";
import { DescriptiveCard } from "@/components/dashboard/descriptive-card";
import { ExperienceCard } from "@/components/dashboard/experience-card";
import { ExportButton } from "@/components/dashboard/export-button";
import { LanguageCard } from "@/components/dashboard/language-card";
import { ProductivityCard } from "@/components/dashboard/productivity-card";
import { ProjectsCard } from "@/components/dashboard/projects-card";
import { RepoProfileCard } from "@/components/dashboard/repo-profile-card";
import { GithubSyncCard } from "@/components/dashboard/github-sync-card";
import { LeetcodeSyncCard } from "@/components/dashboard/leetcode-sync-card";
import { LagCard } from "@/components/dashboard/lag-card";
import { PredictionCard } from "@/components/dashboard/prediction-card";
import { StreakCard } from "@/components/dashboard/streak-card";
import { TodayCodingCard } from "@/components/dashboard/today-coding-card";
import { TrendsCard } from "@/components/dashboard/trends-card";
import { WakatimeSyncCard } from "@/components/dashboard/wakatime-sync-card";
import { WeeklySummaryCard } from "@/components/dashboard/weekly-summary-card";
import { Segmented } from "@/components/ui/segmented";
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

const VIEWS: DashboardView[] = ["overview", "profile", "analytics", "sync"];

// Descriptive and Trends each carried their own range picker, so the two
// halves of the analytics view could silently disagree about which window
// you were looking at. One control in the header, one window.
export type RangeDays = 7 | 30 | 90 | 365;
const RANGES: RangeDays[] = [7, 30, 90, 365];
const RANGE_OPTIONS = [
  { value: 7 as RangeDays, label: "7d" },
  { value: 30 as RangeDays, label: "30d" },
  { value: 90 as RangeDays, label: "90d" },
  { value: 365 as RangeDays, label: "1y" },
];
const DEFAULT_RANGE: RangeDays = 90;

const VIEW_META: Record<DashboardView, { title: string; description: string }> = {
  overview: {
    title: "Overview",
    description:
      "Where this week is heading — today's coding time, burnout risk and a plain-language read on the last seven days.",
  },
  profile: {
    title: "Developer profile",
    description:
      "What the measured data says about how you work — the languages you spend time in, what your repositories are, and how this fortnight compares to the last. Descriptive only: nothing here rates your ability.",
  },
  analytics: {
    title: "Analytics",
    description:
      "Commits, pull requests and reviews are measured from the GitHub API. Sleep, coffee, focus and self-ratings come from your daily log. The analysis keeps the two apart.",
  },
  sync: {
    title: "Sync",
    description: "Pull fresh data in from GitHub and WakaTime, and see when each last ran.",
  },
};

export const Route = createFileRoute("/dashboard")({
  // ?view= is the sidebar's active entry. An unknown or missing value falls
  // back to overview rather than erroring, so an old bookmark still opens.
  // Both left optional so every other `<Link to="/dashboard">` in the app
  // stays valid without spelling them out.
  validateSearch: (
    search: Record<string, unknown>,
  ): { view?: DashboardView; range?: RangeDays } => {
    const view = search["view"];
    const range = Number(search["range"]);
    return {
      ...(VIEWS.includes(view as DashboardView) ? { view: view as DashboardView } : {}),
      ...(RANGES.includes(range as RangeDays) ? { range: range as RangeDays } : {}),
    };
  },
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
  const { view = "overview", range = DEFAULT_RANGE } = Route.useSearch();
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

  // Keyed by view so switching sidebar entries replays the stagger, the way
  // the tabs used to when their content mounted.
  const cards: ReactNode[] =
    view === "overview"
      ? [
          <TodayCodingCard />,
          <StreakCard />,
          <AchievementsCard />,
          <BurnoutCard />,
          <BurnoutTrendCard />,
          <WeeklySummaryCard />,
        ]
      : view === "profile"
        ? [
            <LanguageCard />,
            <ProjectsCard />,
            <ProductivityCard />,
            <ExperienceCard />,
            <AccuracyCard />,
            <RepoProfileCard />,
          ]
        : view === "sync"
          ? [
              <GithubSyncCard />,
              <WakatimeSyncCard />,
              <LeetcodeSyncCard />,
              <CommitCoachCard />,
            ]
        : [
            <DataQualityCard />,
            <DescriptiveCard range={range} />,
            <TrendsCard range={range} />,
            <CorrelationsCard />,
            <LagCard />,
            <PredictionCard />,
          ];

  return (
    <AppShell
      title={VIEW_META[view].title}
      description={VIEW_META[view].description}
      activeView={view}
      actions={
        <>
          {/* Only the analytics cards read a range; showing the control on
              the other views would imply it does something there. */}
          {view === "analytics" && (
            <Segmented
              aria-label="Date range"
              options={RANGE_OPTIONS}
              value={range}
              onValueChange={(next) =>
                void navigate({ to: "/dashboard", search: { view, range: next } })
              }
              className="hidden sm:inline-flex"
            />
          )}
          <ExportButton />
        </>
      }
    >
      <div className="space-y-6">
        <AlertBanner />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          <p className="rounded-lg border border-chart-5/40 bg-chart-5/10 px-3 py-2 text-xs">
            {summary.seededDays} of the last 7 days are generated seed data, not real entries.
          </p>
        )}

        <div key={view} className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {cards.map((card, i) => (
            <Reveal key={i} index={i}>
              {card}
            </Reveal>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
