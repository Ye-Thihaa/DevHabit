import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

async function signInAs(t, userId) {
  return t.withIdentity({ subject: userId });
}

async function makeUser(t, fields = {}) {
  return await t.run(async (ctx) => ctx.db.insert("users", fields));
}

const TODAY = new Date().toISOString().slice(0, 10);

describe("setGoals", () => {
  test("refuses to write anything when signed out", async () => {
    const t = convexTest(schema);
    await expect(t.mutation(api.users.setGoals, { codingHours: 4 })).rejects.toThrow(
      "Not signed in",
    );
  });

  test("stores the goals it is given", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await asUser.mutation(api.users.setGoals, { codingHours: 4, sleepHours: 7.5 });

    const user = await asUser.query(api.users.getCurrentUser, {});
    expect(user.goals).toEqual({ codingHours: 4, sleepHours: 7.5 });
  });

  // Omitting a field and clearing it are different operations, and the
  // settings form relies on the difference.
  test("omitting a field leaves it alone; null clears it", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await asUser.mutation(api.users.setGoals, { codingHours: 4, sleepHours: 7 });
    await asUser.mutation(api.users.setGoals, { commits: 3 });

    let user = await asUser.query(api.users.getCurrentUser, {});
    expect(user.goals).toEqual({ codingHours: 4, sleepHours: 7, commits: 3 });

    await asUser.mutation(api.users.setGoals, { sleepHours: null });
    user = await asUser.query(api.users.getCurrentUser, {});
    expect(user.goals).toEqual({ codingHours: 4, commits: 3 });
  });

  test("clearing every goal leaves no empty object behind", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await asUser.mutation(api.users.setGoals, { codingHours: 4 });
    await asUser.mutation(api.users.setGoals, { codingHours: null });

    const user = await asUser.query(api.users.getCurrentUser, {});
    expect(user.goals).toBeUndefined();
  });

  test("rejects a value outside its range instead of storing a typo", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await expect(asUser.mutation(api.users.setGoals, { sleepHours: 700 })).rejects.toThrow(
      "between 0 and 24",
    );

    const user = await asUser.query(api.users.getCurrentUser, {});
    expect(user.goals).toBeUndefined();
  });
});

describe("getTodaySnapshot reference", () => {
  async function addLog(t, userId, date, codingHours) {
    await t.run(async (ctx) => {
      await ctx.db.insert("dailyLogs", {
        userId,
        date,
        codingHours,
        sleepHours: 7,
        coffeeIntake: 1,
        aiToolUsageMinutes: 0,
        problemsSolved: 1,
        taskDifficulty: 2,
        experienceLevel: 3,
        programmingScore: 5,
      });
    });
  }

  test("falls back to a flat reference with no goal and no history", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    const snapshot = await asUser.query(api.analytics.getTodaySnapshot, {});
    expect(snapshot.referenceKind).toBe("default");
    expect(snapshot.referenceHours).toBe(4);
  });

  // Once someone states what they're aiming for, "vs. what you usually do"
  // is no longer the question being asked.
  test("a coding-hours goal outranks the personal average", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    // Enough history to produce a personal average.
    for (let i = 1; i <= 6; i += 1) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      await addLog(t, userId, date, 2);
    }

    let snapshot = await asUser.query(api.analytics.getTodaySnapshot, {});
    expect(snapshot.referenceKind).toBe("average");
    expect(snapshot.referenceHours).toBeCloseTo(2, 5);

    await asUser.mutation(api.users.setGoals, { codingHours: 6 });

    snapshot = await asUser.query(api.analytics.getTodaySnapshot, {});
    expect(snapshot.referenceKind).toBe("goal");
    expect(snapshot.referenceHours).toBe(6);
    expect(snapshot.date).toBe(TODAY);
  });
});
