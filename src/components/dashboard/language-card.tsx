import { Code2 } from "lucide-react";
import { useQuery } from "convex/react";

import { Card } from "@/components/dashboard/card";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

type Language = {
  name: string;
  hours: number;
  share: number;
  days: number;
  bucket: "frontend" | "backend" | "mobile" | "infra" | "other";
};

type Breakdown = {
  windowDays: number;
  totalHours: number;
  daysWithData: number;
  languages: Language[];
  byBucket: Record<string, number>;
};

const BUCKET_LABEL: Record<string, string> = {
  frontend: "Frontend",
  backend: "Backend",
  mobile: "Mobile",
  infra: "Infrastructure",
  other: "Other",
};

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
];

export function LanguageCard() {
  const result = useQuery(api.profile.getLanguageBreakdown, {}) as Breakdown | null | undefined;

  if (result === undefined) {
    return (
      <Card title="Languages" description="What you actually spend time in." icon={Code2}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Card>
    );
  }
  if (result === null) return null;

  if (result.languages.length === 0) {
    return (
      <Card title="Languages" description="What you actually spend time in." icon={Code2}>
        <p className="text-sm text-muted-foreground">
          No language data yet. This comes from WakaTime — connect a key in Settings and sync, and
          it fills in from your editor automatically.
        </p>
      </Card>
    );
  }

  const top = result.languages.slice(0, 8);
  const rest = result.languages.slice(8);
  const restShare = rest.reduce((sum, l) => sum + l.share, 0);

  // The dominant bucket, phrased as where time went rather than what the
  // developer "is" — the data supports the first claim and not the second.
  const buckets = Object.entries(result.byBucket)
    .filter(([, seconds]) => seconds > 0)
    .sort((a, b) => b[1] - a[1]);
  const leadBucket = buckets[0];
  const leadShare =
    leadBucket && result.totalHours > 0 ? leadBucket[1] / 3600 / result.totalHours : 0;

  return (
    <Card
      title="Languages"
      description="What you actually spend time in, measured by WakaTime — not what you say you know."
      icon={Code2}
    >
      {leadBucket && (
        <p className="mb-4 text-sm">
          Most of your tracked time went to{" "}
          <span className="font-medium">{BUCKET_LABEL[leadBucket[0]]?.toLowerCase()}</span> work —{" "}
          {Math.round(leadShare * 100)}% of {result.totalHours.toFixed(0)} hours over the last{" "}
          {result.windowDays} days.
        </p>
      )}

      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {top.map((language, i) => (
          <div
            key={language.name}
            title={`${language.name}: ${language.hours.toFixed(1)}h`}
            style={{
              width: `${language.share * 100}%`,
              backgroundColor: COLORS[i % COLORS.length],
            }}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {top.map((language, i) => (
          <li key={language.name} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate">{language.name}</span>
            <span className="stat-num shrink-0 text-xs text-muted-foreground">
              {language.days}d
            </span>
            <span className="stat-num w-14 shrink-0 text-right">
              {language.hours.toFixed(1)}h
            </span>
            <span className="stat-num w-10 shrink-0 text-right text-muted-foreground">
              {Math.round(language.share * 100)}%
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
        The <span className="stat-num">d</span> column is how many separate days each language was
        touched. Forty hours across thirty days is part of your routine; forty hours across two days
        was one project — the percentage alone can&rsquo;t tell those apart.
      </p>

      <div className={cn("mt-3 flex flex-wrap gap-1.5")}>
        {buckets.map(([bucket, seconds]) => (
          <span
            key={bucket}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
          >
            {BUCKET_LABEL[bucket]}{" "}
            <span className="stat-num">
              {result.totalHours > 0 ? Math.round((seconds / 3600 / result.totalHours) * 100) : 0}%
            </span>
          </span>
        ))}
      </div>
    </Card>
  );
}
