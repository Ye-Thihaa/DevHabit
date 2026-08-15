import { FolderGit2 } from "lucide-react";
import { useQuery } from "convex/react";

import { Card } from "@/components/dashboard/card";
import { api } from "@convex/_generated/api";

type Project = {
  name: string;
  hours: number;
  share: number;
  days: number;
};

type Breakdown = {
  windowDays: number;
  totalHours: number;
  daysWithData: number;
  projects: Project[];
};

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
];

// Same shape and layout as LanguageCard, deliberately — this is the other
// axis on the same WakaTime seconds (what you built, not what you built it
// with), so reading them side by side should feel like two views of one
// dataset rather than two unrelated features.
export function ProjectsCard() {
  const result = useQuery(api.profile.getProjectBreakdown, {}) as Breakdown | null | undefined;

  if (result === undefined) {
    return (
      <Card title="Projects" description="Where your tracked time actually went." icon={FolderGit2}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Card>
    );
  }
  if (result === null) return null;

  if (result.projects.length === 0) {
    return (
      <Card title="Projects" description="Where your tracked time actually went." icon={FolderGit2}>
        <p className="text-sm text-muted-foreground">
          No project data yet. WakaTime infers this from your editor's working directory — connect a
          key in Settings and sync, and it fills in on its own.
        </p>
      </Card>
    );
  }

  const top = result.projects.slice(0, 8);
  const rest = result.projects.slice(8);
  const restShare = rest.reduce((sum, p) => sum + p.share, 0);
  const lead = top[0];

  return (
    <Card
      title="Projects"
      description="Where your tracked time actually went, measured by WakaTime's own project grouping."
      icon={FolderGit2}
    >
      {lead && (
        <p className="mb-4 text-sm">
          Most of your tracked time went to <span className="font-medium">{lead.name}</span> —{" "}
          {Math.round(lead.share * 100)}% of {result.totalHours.toFixed(0)} hours over the last{" "}
          {result.windowDays} days.
        </p>
      )}

      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {top.map((project, i) => (
          <div
            key={project.name}
            title={`${project.name}: ${project.hours.toFixed(1)}h`}
            style={{
              width: `${project.share * 100}%`,
              backgroundColor: COLORS[i % COLORS.length],
            }}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {top.map((project, i) => (
          <li key={project.name} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate">{project.name}</span>
            <span className="stat-num shrink-0 text-xs text-muted-foreground">{project.days}d</span>
            <span className="stat-num w-14 shrink-0 text-right">{project.hours.toFixed(1)}h</span>
            <span className="stat-num w-10 shrink-0 text-right text-muted-foreground">
              {Math.round(project.share * 100)}%
            </span>
          </li>
        ))}
        {rest.length > 0 && (
          <li className="flex items-center gap-3 text-sm text-muted-foreground">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-muted" />
            <span className="min-w-0 flex-1 truncate">{rest.length} more</span>
            <span className="stat-num w-10 shrink-0 text-right">
              {Math.round(restShare * 100)}%
            </span>
          </li>
        )}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground">
        The <span className="stat-num">d</span> column is how many separate days each project was
        touched — the same distinction as on the Languages card, between an ongoing project and a
        single push.
      </p>
    </Card>
  );
}
