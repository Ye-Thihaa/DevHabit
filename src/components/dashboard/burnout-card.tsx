import { Flame, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";

import { Card } from "@/components/dashboard/card";
import { Button } from "@/components/ui/button";
import { api } from "@convex/_generated/api";

type Assessment = {
  headline: string | null;
  reasoning: string | null;
  suggestions: string[];
};

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
  const getAssessment = useAction(api.burnout.getBurnoutAssessment);

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAssess = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAssessment();
      setAssessment(result);
    } catch (err) {
      setError(err instanceof ConvexError ? (err.data as string) : "Failed to get AI assessment.");
    } finally {
      setLoading(false);
    }
  };

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

          <div className="border-t border-border pt-4">
            <Button variant="outline" size="sm" disabled={loading} onClick={handleAssess}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {loading ? "Asking…" : "Explain this in plain language"}
            </Button>

            {error && <p className="mt-3 font-mono text-xs text-destructive">{error}</p>}

            {assessment && (
              <div className="mt-3 rounded-xl border border-border bg-muted/40 p-4">
                {assessment.headline && <p className="text-sm font-medium">{assessment.headline}</p>}
                {assessment.reasoning && (
                  <p className="mt-1 text-sm text-muted-foreground">{assessment.reasoning}</p>
                )}
                {assessment.suggestions.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                    {assessment.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
