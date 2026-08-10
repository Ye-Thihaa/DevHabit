import { DatabaseZap, Loader2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";

import { Card } from "@/components/dashboard/card";
import type { DataQuality } from "@/lib/analytics-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

// The data-management half of the project: coverage, provenance, gaps and
// suspicious values, stated plainly rather than hidden behind the charts.

function pct(value: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

export function DataQualityCard() {
  const quality: DataQuality | null | undefined = useQuery(api.analytics.getDataQuality, {});
  const generateSeed = useMutation(api.seed.generateSeedData);
  const clearSeed = useMutation(api.seed.clearSeedData);

  const [busy, setBusy] = useState<null | "seed" | "clear">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "seed" | "clear") => {
    setBusy(kind);
    setMessage(null);
    setError(null);
    try {
      if (kind === "seed") {
        const res = await generateSeed({ days: 90, seed: 42 });
        setMessage(
          `Generated ${res.written} seeded day(s) (${res.startDate} → ${res.endDate}), skipped ${res.skippedReal} real entry(ies).`,
        );
      } else {
        const res = await clearSeed({});
        setMessage(`Removed ${res.deleted} seeded day(s).`);
      }
    } catch (err) {
      setError(err instanceof ConvexError ? (err.data as string) : "Operation failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card
      title="Data quality"
      description="Where every number came from, what's missing, and what looks wrong."
      icon={DatabaseZap}
    >
      {quality === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : quality === null || quality.totalDays === 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            No data yet. Back-fill from GitHub for the measured side, and either log days by hand or
            generate labelled seed data to exercise the analysis.
          </p>
          <Button variant="outline" disabled={busy !== null} onClick={() => run("seed")}>
            {busy === "seed" && <Loader2 className="size-4 animate-spin" />}
            Generate 90 days of seed data
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium">Coverage</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {quality.calendarDays} calendar days from {quality.firstDate} to {quality.lastDate}.
            </p>
            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {(
                [
                  ["both", quality.coverage.both, "var(--color-chart-2)"],
                  ["selfOnly", quality.coverage.selfOnly, "var(--color-chart-5)"],
                  ["githubOnly", quality.coverage.githubOnly, "var(--color-chart-3)"],
                ] as const
              ).map(([key, count, color]) => (
                <div
                  key={key}
                  style={{
                    width: `${(count / Math.max(quality.calendarDays, 1)) * 100}%`,
                    backgroundColor: color,
                  }}
                />
              ))}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs sm:grid-cols-4">
              <Stat
                label="Both layers"
                value={`${quality.coverage.both} (${pct(quality.coverage.both, quality.calendarDays)})`}
                dot="var(--color-chart-2)"
              />
              <Stat
                label="Self only"
                value={`${quality.coverage.selfOnly}`}
                dot="var(--color-chart-5)"
              />
              <Stat
                label="GitHub only"
                value={`${quality.coverage.githubOnly}`}
                dot="var(--color-chart-3)"
              />
              <Stat
                label="No data"
                value={`${quality.coverage.missing}`}
                dot="var(--color-muted)"
              />
            </dl>
            {quality.longestGap > 1 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Longest run without a self-reported entry: {quality.longestGap} days. Gaps aren't
                random — days you forget to log are often the unusual ones, which biases every
                statistic on this page.
              </p>
            )}
          </div>

          {quality.seededDays > 0 && (
            <div className="rounded-lg border border-chart-5/40 bg-chart-5/10 p-3">
              <p className="text-sm">
                <strong className="font-medium">{quality.seededDays} day(s) are seed data.</strong>{" "}
                These are generated, not observed. Every chart can exclude them, and the AI summary
                is told which rows they are.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => run("clear")}
                >
                  {busy === "clear" && <Loader2 className="size-4 animate-spin" />}
                  Remove seed data
                </Button>
              </div>
            </div>
          )}

          {quality.lineFiltering.additionsRaw > 0 && (
            <div>
              <h3 className="text-sm font-medium">Line-count cleaning</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Raw GitHub diff stats count installed and generated files, so they measure lockfile
                churn more than authorship. Lockfiles,{" "}
                <code className="font-mono">node_modules</code>, build output, minified bundles and
                binary assets are excluded before any line count is used.
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs sm:grid-cols-4">
                <Stat
                  label="Lines counted"
                  value={quality.lineFiltering.additions.toLocaleString()}
                />
                <Stat
                  label="Raw (unfiltered)"
                  value={quality.lineFiltering.additionsRaw.toLocaleString()}
                />
                <Stat
                  label="Files kept"
                  value={quality.lineFiltering.filesChanged.toLocaleString()}
                />
                <Stat
                  label="Files excluded"
                  value={quality.lineFiltering.filesExcluded.toLocaleString()}
                />
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">
                <strong className="font-medium text-foreground">
                  {(quality.lineFiltering.excludedShare * 100).toFixed(1)}%
                </strong>{" "}
                of the raw diff volume was generated rather than written.
              </p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium">Provenance</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {quality.timezoneOffsetMinutes === null
                ? "No timezone recorded — commit times are bucketed as UTC, which mislabels time-of-day. Open the dashboard while signed in to set it, then re-run the detailed sync."
                : `Commit times bucketed at UTC${quality.timezoneOffsetMinutes >= 0 ? "+" : "−"}${String(
                    Math.floor(Math.abs(quality.timezoneOffsetMinutes) / 60),
                  ).padStart(
                    2,
                    "0",
                  )}:${String(Math.abs(quality.timezoneOffsetMinutes) % 60).padStart(2, "0")}, your local time.`}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs sm:grid-cols-3">
              <Stat
                label="Calendar-level GitHub days"
                value={String(quality.githubDetail.calendar)}
              />
              <Stat label="Detailed GitHub days" value={String(quality.githubDetail.detailed)} />
              <Stat label="Migrated (hand-typed)" value={String(quality.githubDetail.migrated)} />
            </dl>
            {quality.githubDetail.migrated > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                &ldquo;Migrated&rdquo; days hold commit counts that were originally typed in by
                hand, before commits were fetched from the API. They sit in the measured table but
                are not measured — re-run the backfill to replace them with real values.
              </p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium">Field completeness</h3>
            <div className="mt-2 space-y-1">
              {quality.fieldCompleteness.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <span className="flex w-40 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 rounded-full",
                        field.source !== "self" ? "bg-chart-2" : "bg-chart-5",
                      )}
                    />
                    {field.label}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${field.completeness * 100}%` }}
                    />
                  </div>
                  <span className="stat-num w-12 shrink-0 text-right text-xs text-muted-foreground">
                    {Math.round(field.completeness * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {quality.outliers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">Flagged values ({quality.outliers.length})</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Outside the plausible range for that field. They are kept, not deleted — a genuine
                16-hour day is real data, and dropping it would be the bigger error.
              </p>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {quality.outliers.slice(0, 8).map((o, i) => (
                  <li key={`${o.date}-${o.key}-${i}`} className="text-muted-foreground">
                    <span className="text-foreground">{o.date}</span> · {o.label} = {o.value} (
                    {o.reason}, bound {o.bound})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {quality.syncRuns.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">Ingestion log</h3>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {quality.syncRuns.map((run, i) => (
                  <li
                    key={`${run.ranAt}-${i}`}
                    className={cn(
                      run.status === "error" ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    <span className="text-foreground">
                      {new Date(run.ranAt).toISOString().slice(0, 16).replace("T", " ")}
                    </span>{" "}
                    · {run.kind} · {run.startDate}→{run.endDate} · {run.daysWritten} day(s) ·{" "}
                    {run.status}
                    {run.message ? ` — ${run.message}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => run("seed")}
            >
              {busy === "seed" && <Loader2 className="size-4 animate-spin" />}
              Generate seed data (90d)
            </Button>
          </div>

          {message && <p className="font-mono text-xs text-success">{message}</p>}
          {error && <p className="font-mono text-xs text-destructive">{error}</p>}
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        {dot && (
          <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: dot }} />
        )}
        {label}
      </dt>
      <dd className="stat-num mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}
