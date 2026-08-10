import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { shiftDateString } from "./lib/stats.js";

async function signInAs(t, userId) {
  return t.withIdentity({ subject: userId });
}

async function makeUser(t) {
  return await t.run(async (ctx) => ctx.db.insert("users", {}));
}

const TODAY = new Date().toISOString().slice(0, 10);

// Burnout compares a recent 14-day window to the 14 days before it — a
// component is only "available" when both sides have data, so this seeds
// both windows with an identical, unchanging pattern (matching low risk).
async function seedQualifyingUser(t, userId, endDate = TODAY) {
  await t.run(async (ctx) => {
    for (let i = 0; i < 28; i++) {
      await ctx.db.insert("dailyLogs", {
        userId,
        date: shiftDateString(endDate, -i),
        codingHours: 4,
        sleepHours: 7,
        coffeeIntake: 1,
        aiToolUsageMinutes: 0,
        problemsSolved: 1,
        taskDifficulty: 2,
        experienceLevel: 3,
        programmingScore: 5,
      });
    }
  });
}

describe("snapshotAllUsers", () => {
  test("skips a user with insufficient logged days", async () => {
    const t = convexTest(schema);
    await makeUser(t); // no logs at all

    const written = await t.mutation(internal.burnoutHistory.snapshotAllUsers, {});
    expect(written).toBe(0);

    const rows = await t.run(async (ctx) => ctx.db.query("burnoutHistory").collect());
    expect(rows).toHaveLength(0);
  });

  test("writes a row for a qualifying user, matching getBurnoutRisk's own score", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);
    await seedQualifyingUser(t, userId);

    const live = await asUser.query(api.burnout.getBurnoutRisk, {});
    const written = await t.mutation(internal.burnoutHistory.snapshotAllUsers, {});
    expect(written).toBe(1);

    const rows = await t.run(async (ctx) => ctx.db.query("burnoutHistory").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].score).toBe(live.score);
    expect(rows[0].level).toBe(live.level);
    expect(rows[0].date).toBe(TODAY);
  });

  test("running twice the same day updates the row instead of duplicating it", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    await seedQualifyingUser(t, userId);

    await t.mutation(internal.burnoutHistory.snapshotAllUsers, {});
    await t.mutation(internal.burnoutHistory.snapshotAllUsers, {});

    const rows = await t.run(async (ctx) => ctx.db.query("burnoutHistory").collect());
    expect(rows).toHaveLength(1);
  });
});

describe("getBurnoutHistory", () => {
  test("returns [] when not signed in", async () => {
    const t = convexTest(schema);
    expect(await t.query(api.burnoutHistory.getBurnoutHistory, {})).toEqual([]);
  });

  test("returns rows sorted ascending by date", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("burnoutHistory", {
          userId,
          date: shiftDateString(TODAY, -i),
          score: i * 10,
          level: "low",
          sampleSize: 14,
          ranAt: Date.now(),
        });
      }
    });

    const history = await asUser.query(api.burnoutHistory.getBurnoutHistory, { days: 90 });
    expect(history).toHaveLength(5);
    expect(history.map((r) => r.date)).toEqual([...history.map((r) => r.date)].sort());
    expect(history[history.length - 1].date).toBe(TODAY);
  });

  test("only counts another user's history against their own query", async () => {
    const t = convexTest(schema);
    const userA = await makeUser(t);
    const userB = await makeUser(t);
    const asA = await signInAs(t, userA);

    await t.run(async (ctx) => {
      await ctx.db.insert("burnoutHistory", {
        userId: userB,
        date: TODAY,
        score: 90,
        level: "high",
        sampleSize: 14,
        ranAt: Date.now(),
      });
    });

    expect(await asA.query(api.burnoutHistory.getBurnoutHistory, {})).toEqual([]);
  });
});
