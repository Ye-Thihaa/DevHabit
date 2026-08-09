import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";

import { Card } from "@/components/dashboard/card";
import { Button } from "@/components/ui/button";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function WeeklySummaryCard({ userId }: { userId: Id<"users"> }) {
  const generateWeeklySummary = useAction(api.weeklySummary.generateWeeklySummary);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);
    const startDate = daysAgoStr(6);
    const endDate = daysAgoStr(0);
    try {
      const result = await generateWeeklySummary({ userId, startDate, endDate });
      setSummary(result);
      setRange({ start: startDate, end: endDate });
    } catch (err) {
      setError(err instanceof ConvexError ? (err.data as string) : "Failed to generate summary.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="Weekly AI summary"
      description="A plain-language read on the last seven days of logs and commits."
      icon={Sparkles}
    >
      <Button variant="outline" disabled={loading} onClick={handleGenerate}>
        {loading && <Loader2 className="size-4 animate-spin" />}
        {loading ? "Generating…" : "Generate Weekly Summary"}
      </Button>

      {error && <p className="mt-3 font-mono text-xs text-destructive">{error}</p>}

      {summary && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-sm leading-relaxed text-foreground">{summary}</p>
          {range && (
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              Generated from logs · {range.start} → {range.end}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
