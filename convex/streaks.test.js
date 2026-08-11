import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { shiftDateString } from "./lib/stats.js";
import { streaksFrom } from "./streaks.js";

async function signInAs(t, userId) {
  return t.withIdentity({ subject: userId });
}

async function makeUser(t) {
  return await t.run(async (ctx) => ctx.db.insert("users", {}));
}

const TODAY = new Date().toISOString().slice(0, 10);
const day = (offset) => shiftDateString(TODAY, offset);

async function addLog(t, userId, date, fields = {}) {
  await t.run(async (ctx) => {
    await ctx.db.insert("dailyLogs", {
      userId,
      date,
      codingHours: 4,
      sleepHours: 7,
      coffeeIntake: 1,
      aiToolUsageMinutes: 0,
      problemsSolved: 1,
      taskDifficulty: 2,
      experienceLevel: 3,
      programmingScore: 5,
      ...fields,
    });
  });
}

describe("streaksFrom", () => {
  test("counts an unbroken run ending today", () => {
    const dates = [day(0), day(-1), day(-2)];
    expect(streaksFrom(dates, TODAY)).toEqual({ current: 3, longest: 3 });
  });

  // The day isn't over — not having logged yet is not the same as a gap.
  test("today being unlogged does not break the current streak", () => {
    const dates = [day(-1), day(-2), day(-3)];
    expect(streaksFrom(dates, TODAY).current).toBe(3);
  });

  test("a gap before yesterday does end the current streak", () => {
    const dates = [day(-2), day(-3)];
    expect(streaksFrom(dates, TODAY).current).toBe(0);
  });

  test("keeps the longest past run even when the current one is shorter", () => {
    const dates = [day(0), day(-5), day(-6), day(-7), day(-8)];
    expect(streaksFrom(dates, TODAY)).toEqual({ current: 1, longest: 4 });
  });

  test("no logs at all is zero, not a crash", () => {
    expect(streaksFrom([], TODAY)).toEqual({ current: 0, longest: 0 });
  });

  test("duplicate dates cannot inflate a streak", () => {
    const dates = [day(0), day(0), day(-1)];
    expect(streaksFrom(dates, TODAY).current).toBe(2);
  });
});

describe("getLoggingStreak", () => {
  test("returns null when signed out", async () => {
    const t = convexTest(schema);
    expect(await t.query(api.streaks.getLoggingStreak, {})).toBeNull();
  });

  test("seeded rows never count toward a streak", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await addLog(t, userId, day(0), { isSeeded: true });
    await addLog(t, userId, day(-1), { isSeeded: true });
    await addLog(t, userId, day(-2), { isSeeded: true });

    const result = await asUser.query(api.streaks.getLoggingStreak, {});
    expect(result.current).toBe(0);
    expect(result.longest).toBe(0);
    expect(result.daysLoggedInWindow).toBe(0);
  });

  test("real rows count, and the calendar spans the requested window", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await addLog(t, userId, day(0));
    await addLog(t, userId, day(-1));
    await addLog(t, userId, day(-40)); // outside a 30-day calendar

    const result = await asUser.query(api.streaks.getLoggingStreak, { calendarDays: 30 });
    expect(result.current).toBe(2);
    expect(result.loggedToday).toBe(true);
    expect(result.calendar).toHaveLength(30);
    expect(result.calendar.at(-1).date).toBe(TODAY);
    // The old row is still in the streak history but not in the window.
    expect(result.daysLoggedInWindow).toBe(2);
  });

  // A WakaTime user's form never asks for coding hours, so the day is logged
  // with no hours on it — that must still count as a logged day.
  test("a logged day without coding hours still counts", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await addLog(t, userId, day(0), { codingHours: undefined });

    const result = await asUser.query(api.streaks.getLoggingStreak, { calendarDays: 7 });
    expect(result.current).toBe(1);
    expect(result.calendar.at(-1)).toMatchObject({ logged: true, codingHours: null });
  });
});
