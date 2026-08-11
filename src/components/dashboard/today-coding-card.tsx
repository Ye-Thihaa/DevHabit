import { Sun } from "lucide-react";
import { useQuery } from "convex/react";

import { Card } from "@/components/dashboard/card";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

// HH:MM, digital-clock style rather than "1.8h" — matches the JetBrains Mono
// "stat-num" digits used for every other number on the dashboard.
function toClockFace(hours: number) {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function TodayCodingCard() {
  const snapshot = useQuery(api.analytics.getTodaySnapshot);

  const hitReference =
    snapshot != null &&
    snapshot.codingHours !== null &&
    snapshot.codingHours >= snapshot.referenceHours;

  return (
    <Card
      title="Today"
      description="How much you've coded so far today — updates as WakaTime/GitHub sync in."
      icon={Sun}
    >
      {snapshot === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : snapshot === null ? (
        <p className="text-sm text-muted-foreground">Not enough data yet.</p>
      ) : (
        <div className="flex items-center gap-6">
          <div className="rounded-xl border border-border bg-muted/60 px-5 py-4 text-center shadow-[inset_0_2px_6px_rgba(0,0,0,0.25)]">
            <p className="stat-num text-4xl font-semibold tracking-widest text-primary [text-shadow:0_0_14px_var(--color-primary)]">
              {toClockFace(snapshot.codingHours ?? 0)}
            </p>
            <p className="mt-1 text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
              hrs&nbsp;:&nbsp;min
            </p>
          </div>
          <div>
            <p className="mt-1 text-sm text-muted-foreground">
              {snapshot.codingHours === null
                ? "No coding logged yet today"
                : snapshot.source === "wakatime"
                  ? "via WakaTime"
                  : "self-reported"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {snapshot.referenceKind === "goal"
                ? `vs. your ${snapshot.referenceHours.toFixed(1)}h/day goal`
                : snapshot.referenceKind === "average"
                  ? `vs. your ${snapshot.referenceHours.toFixed(1)}h/day average`
                  : `Not enough history for a personal average yet — shown against a ${snapshot.referenceHours}h reference. Set a goal in Settings to compare against that instead.`}
            </p>

            {snapshot.referenceKind !== "default" && (
              <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    hitReference ? "bg-success" : "bg-primary",
                  )}
                  style={{
                    width: `${Math.min(100, ((snapshot.codingHours ?? 0) / snapshot.referenceHours) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
