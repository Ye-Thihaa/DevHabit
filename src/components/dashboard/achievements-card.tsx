import { Award, Check } from "lucide-react";
import { useQuery } from "convex/react";

import { Card } from "@/components/dashboard/card";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

type Achievement = {
  key: string;
  label: string;
  description: string;
  target: number;
  current: number;
  earned: boolean;
};

type Result = {
  earnedCount: number;
  totalCount: number;
  achievements: Achievement[];
};

export function AchievementsCard() {
  const result = useQuery(api.achievements.getAchievements, {}) as Result | null | undefined;

  if (result === undefined) {
    return (
      <Card title="Milestones" description="Round numbers in your own history." icon={Award}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Card>
    );
  }
  if (result === null) return null;

  // Earned first, then everything else closest-to-earning first — the
  // nearly-done ones are the most useful thing to see at a glance.
  const sorted = [...result.achievements].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    return b.current / b.target - a.current / a.target;
  });

  return (
    <Card
      title="Milestones"
      description="Round numbers in your own history — habits and totals, not a skill rating."
      icon={Award}
    >
      <p className="text-sm">
        <span className="stat-num font-medium">{result.earnedCount}</span>
        <span className="text-muted-foreground"> / {result.totalCount} earned</span>
      </p>

      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {sorted.map((a) => (
          <li
            key={a.key}
            className={cn(
              "rounded-xl border p-3",
              a.earned ? "border-primary/40 bg-primary/10" : "border-border bg-muted/30",
            )}
          >
            <div className="flex items-start gap-2">
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border",
                  a.earned
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-transparent",
                )}
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", !a.earned && "text-muted-foreground")}>
                  {a.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
              </div>
            </div>

            {!a.earned && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{ width: `${(a.current / a.target) * 100}%` }}
                  />
                </div>
                <span className="stat-num shrink-0 text-[11px] text-muted-foreground">
                  {a.current}/{a.target}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
