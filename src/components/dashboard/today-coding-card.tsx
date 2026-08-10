import { Sun } from "lucide-react";
import { useQuery } from "convex/react";

import { Card } from "@/components/dashboard/card";
import { api } from "@convex/_generated/api";

const SIZE = 112;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function TodayCodingCard() {
  const snapshot = useQuery(api.analytics.getTodaySnapshot);

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
          <svg width={SIZE} height={SIZE} className="-rotate-90 shrink-0" aria-hidden>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              strokeWidth={STROKE}
              className="fill-none stroke-muted"
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              strokeWidth={STROKE}
              strokeLinecap="round"
              className="fill-none stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={
                CIRCUMFERENCE *
                (1 -
                  Math.max(
                    0,
                    Math.min(1, (snapshot.codingHours ?? 0) / snapshot.referenceHours),
                  ))
              }
            />
          </svg>
          <div>
            <p className="stat-num text-3xl font-semibold">
              {snapshot.codingHours === null ? "0h" : `${snapshot.codingHours.toFixed(1)}h`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {snapshot.codingHours === null
                ? "No coding logged yet today"
                : snapshot.source === "wakatime"
                  ? "via WakaTime"
                  : "self-reported"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {snapshot.referenceIsPersonal
                ? `vs. your ${snapshot.referenceHours.toFixed(1)}h/day average`
                : `Not enough history for a personal average yet — shown against a ${snapshot.referenceHours}h reference.`}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
