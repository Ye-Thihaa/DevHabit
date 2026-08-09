import { Clock4 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";

import { Card } from "@/components/dashboard/card";
import type { LaggedCorrelations } from "@/lib/analytics-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FIELDS, type FieldKey } from "@/lib/fields";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

// Same-day correlation is the wrong question for most of these habits: a short
// night shows up in the *next* day's work. This card runs the same test at
// several offsets so the shape of the delay is visible.
export function LagCard() {
  const [predictor, setPredictor] = useState<FieldKey>("sleepHours");
  const [outcome, setOutcome] = useState<FieldKey>("commits");

  const result: LaggedCorrelations | undefined = useQuery(api.analytics.getLaggedCorrelations, {
    predictorField: predictor,
    outcomeField: outcome,
    maxLag: 3,
  });

  const maxAbsR = Math.max(
    0.01,
    ...(result?.lags ?? []).map((l) => (l.r === null ? 0 : Math.abs(l.r))),
  );

  return (
    <Card
      title="Lagged effects"
      description="Does today's habit line up with today's output, or tomorrow's?"
      icon={Clock4}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Habit (measured on day 0)</label>
          <Select value={predictor} onValueChange={(v) => setPredictor(v as FieldKey)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELDS.map((f) => (
                <SelectItem key={f.key} value={f.key}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Outcome</label>
          <Select value={outcome} onValueChange={(v) => setOutcome(v as FieldKey)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELDS.map((f) => (
                <SelectItem key={f.key} value={f.key}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {result === undefined ? (
        <p className="mt-5 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="mt-5 space-y-2">
            {result.lags.map((lag) => {
              const width = lag.r === null ? 0 : (Math.abs(lag.r) / maxAbsR) * 100;
              return (
                <div key={lag.lag} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                    {lag.lag === 0 ? "same day" : `+${lag.lag} day${lag.lag > 1 ? "s" : ""}`}
                  </span>
                  <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-md transition-all",
                        lag.significant ? "opacity-100" : "opacity-30",
                      )}
                      style={{
                        width: `${width}%`,
                        backgroundColor:
                          lag.r !== null && lag.r < 0
                            ? "var(--color-chart-4)"
                            : "var(--color-chart-2)",
                      }}
                    />
                  </div>
                  <span className="stat-num w-32 shrink-0 text-right text-xs">
                    {lag.r === null ? (
                      <span className="text-muted-foreground">n = {lag.n}, too few</span>
                    ) : (
                      <>
                        r = {lag.r.toFixed(2)}
                        <span className="ml-1 text-muted-foreground">(n = {lag.n})</span>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p>
              Solid bars are significant at p &lt; 0.05; faded bars are not. Because{" "}
              {result.testsRun} lags are tested at once, the honest threshold after correcting for
              multiple comparisons is p &lt; {result.bonferroniAlpha.toFixed(3)} — a single starred
              lag among several is weak evidence on its own.
            </p>
            <p className="mt-2">
              A lag that lines up is still not causation: both sides can follow the same weekly
              rhythm, and a deadline can raise coding hours and lower sleep at once.
            </p>
          </div>
        </>
      )}
    </Card>
  );
}
