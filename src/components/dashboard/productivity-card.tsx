import { Gauge } from "lucide-react";
import { useQuery } from "convex/react";

import { Card } from "@/components/dashboard/card";
import { TechnicalDetails } from "@/components/dashboard/technical-details";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

type Component = {
  key: string;
  label: string;
  recent: number | null;
  prior: number | null;
  ratio: number | null;
  available: boolean;
};

type Result = {
  index: number | null;
  reason: string | null;
  windowDays: number;
  recentDays?: number;
  priorDays?: number;
  minDays?: number;
  signalsUsed?: number;
  signalsTotal?: number;
  components: Component[];
};

function toneOf(index: number) {
  if (index >= 115) return { text: "text-success", bar: "bg-success" };
  if (index >= 85) return { text: "text-foreground", bar: "bg-primary" };
  return { text: "text-chart-4", bar: "bg-chart-4" };
}

export function ProductivityCard() {
  const result = useQuery(api.profile.getProductivityIndex, {}) as Result | null | undefined;

  if (result === undefined) {
    return (
      <Card title="Productivity index" icon={Gauge}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Card>
    );
  }
  if (result === null) return null;

  const description =
    "How the last two weeks compare to the two before them, on your own output. 100 means unchanged.";

  if (result.index === null) {
    return (
      <Card title="Productivity index" description={description} icon={Gauge}>
        <p className="text-sm text-muted-foreground">
          {result.reason === "no-baseline"
            ? "No usable baseline yet — the earlier fortnight has no output to compare against."
            : `Not enough days yet — ${result.recentDays ?? 0} recent and ${result.priorDays ?? 0} earlier day(s), need ${result.minDays ?? 7} on each side.`}
        </p>
      </Card>
    );
  }

  const tone = toneOf(result.index);
  const delta = result.index - 100;

  return (
    <Card title="Productivity index" description={description} icon={Gauge}>
      <div className="flex items-baseline gap-3">
        <p className={cn("stat-num text-4xl font-semibold", tone.text)}>{result.index}</p>
        <p className="text-sm text-muted-foreground">
          {delta === 0
            ? "same as your previous fortnight"
            : `${delta > 0 ? "+" : ""}${delta}% vs your previous fortnight`}
        </p>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        {/* 200 is full width, so the midpoint of the bar is "unchanged". */}
        <div
          className={cn("h-full rounded-full transition-all", tone.bar)}
          style={{ width: `${Math.min(100, (result.index / 200) * 100)}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {result.components.map((c) => (
          <li key={c.key} className="flex items-center gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate">{c.label}</span>
            {c.available && c.ratio !== null ? (
              <>
                <span className="stat-num text-xs text-muted-foreground">
                  {c.prior?.toFixed(1)} → {c.recent?.toFixed(1)}
                </span>
                <span
                  className={cn(
                    "stat-num w-14 shrink-0 text-right",
                    c.ratio > 1.05
                      ? "text-success"
                      : c.ratio < 0.95
                        ? "text-chart-4"
                        : "text-muted-foreground",
                  )}
                >
                  {Math.round(c.ratio * 100)}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">no baseline</span>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground">
        This compares you to <span className="font-medium">yourself</span>, not to other developers
        — the app has no data about anyone else, so a score claiming otherwise would be invented. A
        low number is not a verdict either: fewer commits during a hard debugging week is normal.
      </p>

      <TechnicalDetails>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            Each signal is a daily mean over {result.windowDays} days, divided by the same mean for
            the preceding {result.windowDays} days, capped at 3× so one runaway signal can&rsquo;t
            drag the headline. The index is the mean of the available ratios ×100 —{" "}
            {result.signalsUsed} of {result.signalsTotal} signals had a usable baseline.
          </p>
          <p>
            Seeded rows are excluded. Days with no data are dropped rather than counted as zero, so
            a week you forgot to log doesn&rsquo;t read as a week you did nothing.
          </p>
        </div>
      </TechnicalDetails>
    </Card>
  );
}
