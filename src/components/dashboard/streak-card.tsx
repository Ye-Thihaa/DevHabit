import { Flame } from "lucide-react";
import { useQuery } from "convex/react";

import { Card } from "@/components/dashboard/card";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

type CalendarDay = {
  date: string;
  logged: boolean;
  codingHours: number | null;
};

type StreakResult = {
  current: number;
  longest: number;
  today: string;
  loggedToday: boolean;
  calendarDays: number;
  daysLoggedInWindow: number;
  calendar: CalendarDay[];
};

const WEEKDAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

// Four bands rather than a continuous ramp: the eye can compare four shades
// reliably and cannot compare forty. A logged day with no hours on it (a
// WakaTime user, whose form never asks) still has to look logged, so it takes
// the second band rather than falling to "empty".
function intensityClass(day: CalendarDay, busyHours: number) {
  if (!day.logged) return "bg-muted/40";
  if (day.codingHours === null) return "bg-chart-2/40";
  const share = busyHours > 0 ? day.codingHours / busyHours : 0;
  if (share >= 0.75) return "bg-chart-2";
  if (share >= 0.4) return "bg-chart-2/70";
  return "bg-chart-2/35";
}

function weekdayIndex(date: string) {
  // Monday-first, so the grid reads the way a week does.
  const jsDay = new Date(`${date}T00:00:00`).getDay();
  return (jsDay + 6) % 7;
}

export function StreakCard() {
  const result = useQuery(api.streaks.getLoggingStreak, {}) as StreakResult | null | undefined;

  if (result === undefined) {
    return (
      <Card title="Logging streak" description="How consistently you show up." icon={Flame}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Card>
    );
  }

  if (result === null) {
    return null;
  }

  // The 90th-percentile day, not the maximum — one 14-hour crunch day would
  // otherwise flatten every normal day into the palest band.
  const hours = result.calendar
    .map((d) => d.codingHours)
    .filter((h): h is number => typeof h === "number")
    .sort((a, b) => a - b);
  const busyHours = hours.length > 0 ? (hours[Math.floor(hours.length * 0.9)] ?? 0) : 0;

  // Pad the front so the first column starts on the right weekday.
  const leadingBlanks = result.calendar[0] ? weekdayIndex(result.calendar[0].date) : 0;
  const cells: (CalendarDay | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...result.calendar,
  ];

  const weeks: (CalendarDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const coverage = Math.round((result.daysLoggedInWindow / result.calendarDays) * 100);

  return (
    <Card title="Logging streak" description="How consistently you show up." icon={Flame}>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Current</p>
          <p className="stat-num mt-0.5 text-2xl font-semibold">
            {result.current}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              day{result.current === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Longest</p>
          <p className="stat-num mt-0.5 text-2xl font-semibold">
            {result.longest}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              day{result.longest === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Covered</p>
          <p className="stat-num mt-0.5 text-2xl font-semibold">
            {coverage}
            <span className="ml-1 text-sm font-normal text-muted-foreground">%</span>
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm">
        {result.current === 0
          ? "No run going right now — logging today starts one."
          : result.loggedToday
            ? `${result.current} day${result.current === 1 ? "" : "s"} in a row, today included.`
            : `${result.current} day${result.current === 1 ? "" : "s"} in a row — today isn't logged yet.`}
      </p>

      <div className="mt-4 -mx-1 overflow-x-auto px-1">
        <div className="flex gap-2">
          <div className="flex shrink-0 flex-col gap-[3px] pt-[1px]">
            {WEEKDAY_LABELS.map((label, i) => (
              <span
                key={i}
                className="h-[13px] font-mono text-[9px] leading-[13px] text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-[3px]">
            {weeks.map((week, w) => (
              <div key={w} className="flex flex-col gap-[3px]">
                {week.map((day, d) =>
                  day === null ? (
                    <span key={d} className="size-[13px]" />
                  ) : (
                    <span
                      key={d}
                      title={
                        day.logged
                          ? `${day.date} — logged${
                              day.codingHours === null
                                ? ""
                                : `, ${day.codingHours.toFixed(1)}h coding`
                            }`
                          : `${day.date} — not logged`
                      }
                      className={cn("size-[13px] rounded-[3px]", intensityClass(day, busyHours))}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Last {result.calendarDays} days. Generated seed data is excluded.
        </p>
        <div className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          <span>less</span>
          <span className="size-[10px] rounded-[2px] bg-muted/40" />
          <span className="size-[10px] rounded-[2px] bg-chart-2/35" />
          <span className="size-[10px] rounded-[2px] bg-chart-2/70" />
          <span className="size-[10px] rounded-[2px] bg-chart-2" />
          <span>more</span>
        </div>
      </div>
    </Card>
  );
}
