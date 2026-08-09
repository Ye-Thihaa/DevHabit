import { TrendingUp } from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";

import { Card } from "@/components/dashboard/card";
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
import { FIELDS, type FieldKey } from "@/lib/fields";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export function PredictionCard({ userId }: { userId: Id<"users"> }) {
  const [predictor, setPredictor] = useState<FieldKey>("sleepHours");
  const [output, setOutput] = useState<FieldKey>("githubCommits");
  const [value, setValue] = useState("7.5");
  const [args, setArgs] = useState<{
    userId: Id<"users">;
    predictorField: string;
    outputField: string;
    plannedValue: number;
  } | null>(null);

  const result = useQuery(api.predictions.predictOutput, args ?? "skip");

  const predict = () => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setArgs({ userId, predictorField: predictor, outputField: output, plannedValue: n });
  };

  const outLabel = FIELDS.find((f) => f.key === output)?.label ?? "";

  return (
    <Card
      title="Prediction"
      description="A single-variable estimate from your own history. Directional, not deterministic."
      icon={TrendingUp}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label>Predictor field</Label>
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
          <Label>Output field</Label>
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
        <Button onClick={predict}>Predict</Button>
      </div>

      {args &&
        result !== undefined &&
        result !== null &&
        (result.predicted === null ? (
          <p className="mt-5 text-sm text-muted-foreground">
            Not enough data yet ({result.sampleSize} day(s) logged) — log more days first.
          </p>
        ) : (
          <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">Estimated {outLabel}</p>
            <p className="stat-num mt-1 text-3xl font-semibold">
              {result.predicted.toFixed(result.predicted >= 20 ? 0 : 1)}
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              n = {result.sampleSize} days
              {result.rSquared !== null && ` · R² = ${result.rSquared.toFixed(2)}`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Rough estimate from a small amount of your own data — treat it as a hypothesis to
              test, not a guarantee.
            </p>
          </div>
        ))}
    </Card>
  );
}
