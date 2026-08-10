import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { shiftDateString } from "./lib/stats.js";

async function signInAs(t, userId) {
  return t.withIdentity({ subject: userId });
}

async function makeUser(t) {
  return await t.run(async (ctx) => ctx.db.insert("users", {}));
}

const TODAY = new Date().toISOString().slice(0, 10);

describe("buildDataset coding-hours priority", () => {
  test("WakaTime's measured hours override the self-reported figure for the same day", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await t.run(async (ctx) => {
      await ctx.db.insert("dailyLogs", {
        userId,
        date: TODAY,
        codingHours: 2, // self-reported, should be overridden
        sleepHours: 7,
        coffeeIntake: 1,
        aiToolUsageMinutes: 0,
        problemsSolved: 1,
        taskDifficulty: 2,
        experienceLevel: 3,
        programmingScore: 5,
      });
      await ctx.db.insert("wakatimeDaily", {
        userId,
        date: TODAY,
        codingSeconds: 3600 * 5, // 5 hours measured
        fetchedAt: Date.now(),
      });
    });

    const rows = await asUser.query(api.analytics.getDataset, {});
    const row = rows.find((r) => r.date === TODAY);
    expect(row.codingHours).toBe(5);
  });

  test("a zero-second WakaTime day falls back to self-reported, not a confident zero", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await t.run(async (ctx) => {
      await ctx.db.insert("dailyLogs", {
        userId,
        date: TODAY,
        codingHours: 4,
        sleepHours: 7,
        coffeeIntake: 1,
        aiToolUsageMinutes: 0,
        problemsSolved: 1,
        taskDifficulty: 2,
        experienceLevel: 3,
        programmingScore: 5,
      });
      // e.g. a day before WakaTime was installed — the API can't tell that
      // apart from a genuine zero-coding day.
      await ctx.db.insert("wakatimeDaily", { userId, date: TODAY, codingSeconds: 0, fetchedAt: Date.now() });
    });

    const rows = await asUser.query(api.analytics.getDataset, {});
    expect(rows.find((r) => r.date === TODAY).codingHours).toBe(4);
  });

  test("without WakaTime data, the self-reported figure is used as-is", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await t.run(async (ctx) => {
      await ctx.db.insert("dailyLogs", {
        userId,
        date: TODAY,
        codingHours: 3,
        sleepHours: 7,
        coffeeIntake: 1,
        aiToolUsageMinutes: 0,
        problemsSolved: 1,
        taskDifficulty: 2,
        experienceLevel: 3,
        programmingScore: 5,
      });
    });

    const rows = await asUser.query(api.analytics.getDataset, {});
    expect(rows.find((r) => r.date === TODAY).codingHours).toBe(3);
  });
});

describe("getTodaySnapshot", () => {
  test("returns null when not signed in", async () => {
    const t = convexTest(schema);
    expect(await t.query(api.analytics.getTodaySnapshot, {})).toBeNull();
  });

  test("a brand-new user with no data at all gets a neutral default reference", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    const snapshot = await asUser.query(api.analytics.getTodaySnapshot, {});
    expect(snapshot.codingHours).toBeNull();
    expect(snapshot.source).toBeNull();
    expect(snapshot.referenceHours).toBe(4);
    expect(snapshot.referenceIsPersonal).toBe(false);
  });

  test("today's WakaTime hours are reported with source 'wakatime'", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await t.run(async (ctx) => {
      await ctx.db.insert("wakatimeDaily", {
        userId,
        date: TODAY,
        codingSeconds: 3600 * 2.5,
        fetchedAt: Date.now(),
      });
    });

    const snapshot = await asUser.query(api.analytics.getTodaySnapshot, {});
    expect(snapshot.codingHours).toBe(2.5);
    expect(snapshot.source).toBe("wakatime");
  });

  test("5+ days of trailing history switches the reference to a personal average", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await t.run(async (ctx) => {
      for (let i = 1; i <= 5; i++) {
        await ctx.db.insert("wakatimeDaily", {
          userId,
          date: shiftDateString(TODAY, -i),
          codingSeconds: 3600 * 6, // 6h every prior day
          fetchedAt: Date.now(),
        });
      }
    });

    const snapshot = await asUser.query(api.analytics.getTodaySnapshot, {});
    expect(snapshot.referenceIsPersonal).toBe(true);
    expect(snapshot.referenceHours).toBe(6);
  });
});
