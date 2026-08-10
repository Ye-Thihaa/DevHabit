import { Flame } from "lucide-react";
import { useQuery } from "convex/react";

import { Card } from "@/components/dashboard/card";
import { api } from "@convex/_generated/api";

const LEVEL_STYLE = {
  low: "text-success",
  moderate: "text-chart-5",
  high: "text-destructive",
} as const;

const LEVEL_LABEL = {
  low: "Low risk",
  moderate: "Moderate risk",
  high: "High risk",
} as const;

function formatDelta(delta: number, unit: string) {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(unit === "fraction" ? 2 : 1)} ${unit === "fraction" ? "" : unit}`.trim();
}

export function BurnoutCard() {
  const risk = useQuery(api.burnout.getBurnoutRisk);

  return (
    <Card
      title="Burnout risk"
      description="A rule-based score comparing your last 14 days to the 14 before that — not a trained model, just the trend in what you already track."
      icon={Flame}
    >
      {risk === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : risk.reason === "insufficient-data" ? (
        <p className="text-sm text-muted-foreground">
          Need at least {risk.minDays} logged day(s) in the last 14 to compute a score — you have{" "}
          {risk.sampleSize}.
        </p>
      ) : risk.reason === "not-signed-in" || risk.score === null ? (
        <p className="text-sm text-muted-foreground">Not enough data yet.</p>
      ) : (
        <div className="space-y-5">
          <div className="flex items-baseline gap-3">
            <span className="stat-num text-4xl font-semibold">{risk.score}</span>
            <span className={`text-sm font-medium ${LEVEL_STYLE[risk.level as keyof typeof LEVEL_STYLE]}`}>
              {LEVEL_LABEL[risk.level as keyof typeof LEVEL_LABEL]}
            </span>
            <span className="text-xs text-muted-foreground">
              based on {risk.sampleSize}/{risk.windowDays} logged days
            </span>
          </div>

          <ul className="space-y-2">
            {risk.components
              .filter((c: { available: boolean }) => c.available)
              .map((c: { key: string; label: string; delta: number; unit: string }) => (
                <li key={c.key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="font-mono text-xs">
                    {formatDelta(c.delta as number, c.unit as string)} vs. prior 14 days
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
