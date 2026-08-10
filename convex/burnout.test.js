import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { shiftDateString } from "./lib/stats.js";
import { MIN_DAYS_FOR_BURNOUT } from "./lib/thresholds.js";

// getAuthUserId() just reads identity.subject (see @convex-dev/auth), so a
// fake identity whose subject equals a real users._id is enough to act as
// that user in tests without going through the OAuth flow.
async function signInAs(t, userId) {
  return t.withIdentity({ subject: userId });
}

async function makeUser(t) {
  return await t.run(async (ctx) => ctx.db.insert("users", {}));
}

const TODAY = new Date().toISOString().slice(0, 10);

// Fills a 14-day window ending at `endDate` with identical daily rows across
// all three sources, so tests can move one field away from the baseline and
// see exactly one signal react.
async function seedWindow(t, userId, endDate, { sleepHours = 7, commits = 3, nightShare = 0 } = {}) {
  await t.run(async (ctx) => {
    for (let i = 0; i < 14; i++) {
      const date = shiftDateString(endDate, -i);
      await ctx.db.insert("dailyLogs", {
        userId,
        date,
        codingHours: 4,
        sleepHours,
        coffeeIntake: 1,
        aiToolUsageMinutes: 0,
        problemsSolved: 1,
        taskDifficulty: 2,
        experienceLevel: 3,
        programmingScore: 5,
      });
      const nightCommits = Math.round(commits * nightShare);
      await ctx.db.insert("githubDaily", {
        userId,
        date,
        commits,
        pullRequestsOpened: 0,
        issuesOpened: 0,
        reviews: 0,
        commitsByBucket: {
          night: nightCommits,
          morning: commits - nightCommits,
          afternoon: 0,
          evening: 0,
        },
        detailLevel: "detailed",
        fetchedAt: Date.now(),
      });
    }
  });
}

describe("getBurnoutRisk", () => {
  test("not signed in returns a null score with reason not-signed-in", async () => {
    const t = convexTest(schema);
    const result = await t.query(api.burnout.getBurnoutRisk, {});
    expect(result.score).toBeNull();
    expect(result.reason).toBe("not-signed-in");
  });

  test("fewer than MIN_DAYS_FOR_BURNOUT logged days returns insufficient-data", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await t.run(async (ctx) => {
      for (let i = 0; i < MIN_DAYS_FOR_BURNOUT - 1; i++) {
        await ctx.db.insert("dailyLogs", {
          userId,
          date: shiftDateString(TODAY, -i),
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

    const result = await asUser.query(api.burnout.getBurnoutRisk, {});
    expect(result.score).toBeNull();
    expect(result.reason).toBe("insufficient-data");
    expect(result.minDays).toBe(MIN_DAYS_FOR_BURNOUT);
  });

  test("a sleep drop and higher night-commit share in the recent window raises the score", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    // Prior window: healthy baseline. Recent window: less sleep, more
    // late-night commits — both are risk-increasing signals.
    const priorEnd = shiftDateString(TODAY, -14);
    await seedWindow(t, userId, priorEnd, { sleepHours: 7.5, commits: 4, nightShare: 0 });
    await seedWindow(t, userId, TODAY, { sleepHours: 5, commits: 4, nightShare: 0.5 });

    const result = await asUser.query(api.burnout.getBurnoutRisk, {});
    expect(result.score).not.toBeNull();
    expect(result.score).toBeGreaterThan(0);
    expect(result.sampleSize).toBe(14);

    const sleep = result.components.find((c) => c.key === "sleep");
    expect(sleep.available).toBe(true);
    expect(sleep.delta).toBeCloseTo(-2.5, 5);
    expect(sleep.risk).toBeGreaterThan(0);

    const nightShare = result.components.find((c) => c.key === "nightShare");
    expect(nightShare.delta).toBeCloseTo(0.5, 5);
    expect(nightShare.risk).toBeGreaterThan(0);
  });

  test("an unchanged pattern across both windows scores low risk", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    const priorEnd = shiftDateString(TODAY, -14);
    await seedWindow(t, userId, priorEnd, { sleepHours: 7, commits: 3, nightShare: 0.1 });
    await seedWindow(t, userId, TODAY, { sleepHours: 7, commits: 3, nightShare: 0.1 });

    const result = await asUser.query(api.burnout.getBurnoutRisk, {});
    expect(result.score).toBe(0);
    expect(result.level).toBe("low");
  });
});

describe("getBurnoutAssessment", () => {
  test("skips the LLM call and passes the reason through when there is no score", async () => {
    const t = convexTest(schema);
    const result = await t.action(api.burnout.getBurnoutAssessment, {});
    expect(result.score).toBeNull();
    expect(result.reason).toBe("not-signed-in");
    expect(result.headline).toBeNull();
    expect(result.suggestions).toEqual([]);
  });

  test("without ANTHROPIC_API_KEY, falls back to a mock assessment that keeps the rule-based score", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);
    await seedWindow(t, userId, TODAY, { sleepHours: 7, commits: 3, nightShare: 0.1 });
    await seedWindow(t, userId, shiftDateString(TODAY, -14), {
      sleepHours: 7,
      commits: 3,
      nightShare: 0.1,
    });

    const result = await asUser.action(api.burnout.getBurnoutAssessment, {});
    // The LLM must never be allowed to override the computed score/level —
    // it only narrates it.
    expect(result.score).toBe(0);
    expect(result.level).toBe("low");
    expect(typeof result.headline).toBe("string");
  });
});
