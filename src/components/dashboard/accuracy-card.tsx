import { Scale } from "lucide-react";
import { useQuery } from "convex/react";

import { Card } from "@/components/dashboard/card";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

type MetricReport =
  | { available: false; sampleSize: number; minDays: number }
  | {
      available: true;
      sampleSize: number;
      meanSelf: number;
      meanMeasured: number;
      meanBias: number;
      biasPercent: number | null;
      meanAbsoluteError: number;
      correlation: number | null;
      correlationSignificant: boolean;
    };

type AccuracyReport = {
  windowDays: number;
  codingHours: MetricReport;
  problemsSolved: MetricReport;
};

function fmt(n: number, decimals = 1) {
  return n.toFixed(decimals);
}

function MetricRow({
  label,
  unit,
  report,
}: {
  label: string;
  unit: string;
  report: MetricReport;
}) {
  if (!report.available) {
    return (
      <div className="rounded-xl border border-dashed border-border p-3">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {report.sampleSize === 0
            ? "No days yet where both a self-reported and a measured figure exist for the same day."
            : `Only ${report.sampleSize} overlapping day(s) so far — need at least ${report.minDays}.`}
        </p>
      </div>
    );
  }

  const magnitude = Math.abs(report.biasPercent ?? 0);
  const direction = report.meanBias > 0 ? "overestimate" : report.meanBias < 0 ? "underestimate" : null;

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="stat-num text-xs text-muted-foreground">{report.sampleSize} overlapping days</p>
      </div>

      <p className="mt-2 text-sm">
        {direction === null ? (
          "Your self-reports match the measured figure almost exactly, on average."
        ) : (
          <>
            You tend to {direction} by about{" "}
            <span className="stat-num font-medium">
              {fmt(Math.abs(report.meanBias))}
              {unit}
            </span>
            {report.biasPercent !== null && (
              <span className="text-muted-foreground"> ({fmt(magnitude, 0)}%)</span>
            )}{" "}
            a day.
          </>
        )}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs">
        <div>
          <p className="text-muted-foreground">self-reported</p>
          <p className="stat-num mt-0.5 text-sm">
            {fmt(report.meanSelf)}
            {unit}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">measured</p>
          <p className="stat-num mt-0.5 text-sm">
            {fmt(report.meanMeasured)}
            {unit}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">typical miss</p>
          <p className="stat-num mt-0.5 text-sm">
            ±{fmt(report.meanAbsoluteError)}
            {unit}
          </p>
        </div>
      </div>

      {report.correlation !== null && (
        <p className="mt-2 text-xs text-muted-foreground">
          {report.correlationSignificant ? (
            <>
              Even with that bias, your reports move with reality — busier measured days reliably get
              a higher self-report too (r = {report.correlation.toFixed(2)}).
            </>
          ) : (
            "Not enough of a pattern yet to say whether your reports track the measured days consistently."
          )}
        </p>
      )}
    </div>
  );
}

export function AccuracyCard() {
  const report = useQuery(api.accuracy.getAccuracyReport, {}) as AccuracyReport | null | undefined;

  if (report === undefined) {
    return (
      <Card title="How accurate is your self-reporting?" icon={Scale}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Card>
    );
  }
  if (report === null) return null;

  return (
    <Card
      title="How accurate is your self-reporting?"
      description="Comparing what you typed in against what WakaTime/LeetCode actually measured, on the days both exist."
      icon={Scale}
    >
      <div className={cn("space-y-3")}>
        <MetricRow label="Coding hours" unit="h" report={report.codingHours} />
        <MetricRow label="Problems solved" unit=" problems" report={report.problemsSolved} />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        This only compares days that have <em>both</em> a self-reported and a measured figure —
        usually old entries a later sync backfilled over. Once a source is connected, the form stops
        asking and there is nothing left to compare going forward, so this stays a small, historical
        sample rather than a running score.
      </p>
    </Card>
  );
}
