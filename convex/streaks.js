import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { shiftDateString } from "./lib/stats.js";

// Consistency, not volume. Every other statistic in the app degrades quietly
// when logging stops — correlations lose pairs, the burnout window empties,
// predictions fall under their minimum sample. This is the one number that
// makes that failure visible before it silently ruins the analysis.
//
// Seeded rows never count. A streak built from generated demo data would be
// the exact opposite of what this measures.

const DEFAULT_CALENDAR_DAYS = 182;

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

// Longest run of consecutive dates in a set, and the run ending at `endDate`.
export function streaksFrom(loggedDates, today) {
  const logged = new Set(loggedDates);

  // A day that hasn't ended yet shouldn't break a streak. If today isn't
  // logged, the current run is measured to yesterday instead; only a gap
  // before that actually ends it.
  const anchor = logged.has(today) ? today : shiftDateString(today, -1);

  let current = 0;
  let cursor = anchor;
  while (logged.has(cursor)) {
    current += 1;
    cursor = shiftDateString(cursor, -1);
  }

  let longest = 0;
  for (const date of logged) {
    // Only count from the start of a run, so each run is walked once.
    if (logged.has(shiftDateString(date, -1))) continue;
    let length = 0;
    let walk = date;
    while (logged.has(walk)) {
      length += 1;
      walk = shiftDateString(walk, 1);
    }
    if (length > longest) longest = length;
  }

  return { current, longest };
}

export const getLoggingStreak = query({
  args: { calendarDays: v.optional(v.number()) },
  handler: async (ctx, { calendarDays = DEFAULT_CALENDAR_DAYS }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const today = todayString();
    const calendarStart = shiftDateString(today, -(calendarDays - 1));

    // The whole history, because the longest streak may predate the calendar
    // window — a user shouldn't lose their record just because it scrolled off.
    const logs = await ctx.db
      .query("dailyLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const realLogs = logs.filter((l) => l.isSeeded !== true);
    const loggedDates = realLogs.map((l) => l.date);
    const { current, longest } = streaksFrom(loggedDates, today);

    const byDate = new Map(realLogs.map((l) => [l.date, l]));

    const calendar = [];
    for (let i = 0; i < calendarDays; i += 1) {
      const date = shiftDateString(calendarStart, i);
      const log = byDate.get(date);
      calendar.push({
        date,
        logged: Boolean(log),
        // Drives the heatmap's intensity. Null on a logged day means the user
        // has WakaTime connected, so the form never asked for coding hours —
        // the day still counts as logged, it just has no intensity of its own.
        codingHours: typeof log?.codingHours === "number" ? log.codingHours : null,
      });
    }

    const inWindow = calendar.filter((d) => d.logged).length;

    return {
      current,
      longest,
      today,
      loggedToday: byDate.has(today),
      calendarDays,
      daysLoggedInWindow: inWindow,
      calendar,
    };
  },
});
