import { TrendingUp } from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";

import { Card } from "@/components/dashboard/card";
import type { PredictionResult } from "@/lib/analytics-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FIELDS, fieldLabel, type FieldKey } from "@/lib/fields";
import { api } from "@convex/_generated/api";

const LAGS = [0, 1, 2] as const;

function formatValue(value: number) {
  return Math.abs(value) >= 20 ? value.toFixed(0) : value.toFixed(1);
}

export function PredictionCard() {
  const [predictor, setPredictor] = useState<FieldKey>("sleepHours");
  const [output, setOutput] = useState<FieldKey>("commits");
  const [value, setValue] = useState("7.5");
  const [lag, setLag] = useState<number>(1);
  const [args, setArgs] = useState<{
    predictorField: string;
    outputField: string;
    plannedValue: number;
    lag: number;
  } | null>(null);

  const result: PredictionResult | undefined = useQuery(
    api.predictions.predictOutput,
    args ?? "skip",
  );

  const predict = () => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setArgs({ predictorField: predictor, outputField: output, plannedValue: n, lag });
  };

  const outLabel = fieldLabel(output);

  return (
    <Card
      title="Prediction"
      description="Least-squares fit on your own history, reported with the uncertainty around it."
      icon={TrendingUp}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <div className="space-y-2">
          <Label>Predictor</Label>
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
        <div className="space-y-2 sm:w-28">
          <Label htmlFor="planned">Planned value</Label>
          <Input
            id="planned"
            type="number"
            step="0.5"
            className="stat-num"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Outcome</Label>
          <Select value={output} onValueChange={(v) => setOutput(v as FieldKey)}>
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

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label>Outcome measured</Label>
          <div className="flex rounded-lg border border-border p-0.5">
            {LAGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLag(l)}
                className={
                  "rounded-md px-3 py-1 font-mono text-xs transition-colors " +
                  (lag === l
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {l === 0 ? "same day" : `+${l} day${l > 1 ? "s" : ""}`}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={predict}>Predict</Button>
      </div>

      {args && result !== undefined && result !== null && (
        <>
          {result.predicted === null ? (
            <p className="mt-5 text-sm text-muted-foreground">
              {result.reason === "no-variation"
                ? "That predictor never changed across your logged days, so no line can be fitted to it."
                : `Not enough overlapping days yet — ${result.sampleSize} usable pair(s), need at least ${result.minSample ?? 10}.`}
            </p>
          ) : (
            <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground">
                Estimated {outLabel}
                {result.lag ? ` ${result.lag} day(s) later` : ""}
              </p>
              <p className="stat-num mt-1 text-3xl font-semibold">
                {formatValue(result.predicted)}
              </p>
              {result.low !== null && result.high !== null && (
                <p className="stat-num mt-1 text-sm text-muted-foreground">
                  95% prediction interval {formatValue(result.low)} – {formatValue(result.high)}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
                <span>n = {result.sampleSize}</span>
                {result.rSquared !== null && <span>R² = {result.rSquared.toFixed(3)}</span>}
                {result.slope !== null && <span>slope = {result.slope.toFixed(3)}</span>}
                {result.slopeP !== null && (
                  <span>
                    p {result.slopeP < 0.001 ? "< 0.001" : `= ${result.slopeP.toFixed(3)}`}
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-2 text-xs">
                {!result.significant && (
                  <p className="text-destructive">
                    The slope is not statistically distinguishable from zero (p ≥{" "}
                    {result.alpha ?? 0.05}). On this data, {fieldLabel(predictor)} tells you nothing
                    reliable about {outLabel} — the estimate above is close to guessing the average.
                  </p>
                )}
                {result.extrapolating && result.observedRange && (
                  <p className="text-muted-foreground">
                    {value} is outside the range you have actually logged (
                    {formatValue(result.observedRange.min)} –{" "}
                    {formatValue(result.observedRange.max)}
                    ), so this is extrapolation and the interval understates the real uncertainty.
                  </p>
                )}
                {result.seededPairs > 0 && (
                  <p className="text-muted-foreground">
                    {result.seededPairs} of {result.sampleSize} pairs come from generated seed data.
                  </p>
                )}
                {result.predictorSource === "self" && result.outputSource === "self" && (
                  <p className="text-muted-foreground">
                    Both sides are self-reported, so a relationship here may reflect how you rate
                    days rather than what happened in them.
                  </p>
                )}
                <p className="text-muted-foreground">
                  A fitted line describes association, not cause. Nothing here establishes that
                  changing {fieldLabel(predictor)} would change {outLabel}.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
