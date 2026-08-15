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
const day = (offset) => shiftDateString(TODAY, offset);

async function addLog(t, userId, date, fields = {}) {
  await t.run(async (ctx) => {
    await ctx.db.insert("dailyLogs", {
      userId,
      date,
      sleepHours: 7,
      coffeeIntake: 1,
      aiToolUsageMinutes: 0,
      taskDifficulty: 2,
      experienceLevel: 3,
      programmingScore: 5,
      ...fields,
    });
  });
}

async function addGithub(t, userId, date, fields = {}) {
  await t.run(async (ctx) => {
    await ctx.db.insert("githubDaily", {
      userId,
      date,
      commits: 3,
      pullRequestsOpened: 0,
      issuesOpened: 0,
      reviews: 0,
      detailLevel: "detailed",
      fetchedAt: Date.now(),
      ...fields,
    });
  });
}

async function addWakatime(t, userId, date, codingSeconds, languages = []) {
  await t.run(async (ctx) => {
    await ctx.db.insert("wakatimeDaily", {
      userId,
      date,
      codingSeconds,
      languages,
      projects: [],
      fetchedAt: Date.now(),
    });
  });
}

async function addLeetcode(t, userId, date, totalSolved) {
  await t.run(async (ctx) => {
    await ctx.db.insert("leetcodeDaily", {
      userId,
      date,
      totalSolved,
      easySolved: totalSolved,
      mediumSolved: 0,
      hardSolved: 0,
      fetchedAt: Date.now(),
    });
  });
}

function find(result, key) {
  return result.achievements.find((a) => a.key === key);
}

describe("getAchievements", () => {
  test("returns null when signed out", async () => {
    const t = convexTest(schema);
    expect(await t.query(api.achievements.getAchievements, {})).toBeNull();
  });

  test("nothing is earned with no data at all", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    const result = await asUser.query(api.achievements.getAchievements, {});
    expect(result.earnedCount).toBe(0);
    expect(result.totalCount).toBe(result.achievements.length);
    expect(result.achievements.every((a) => !a.earned)).toBe(true);
  });

  test("first log and connection badges earn as soon as one row exists", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await addLog(t, userId, day(0));
    await addGithub(t, userId, day(0));
    await addWakatime(t, userId, day(0), 3600);
    await addLeetcode(t, userId, day(0), 5);

    const result = await asUser.query(api.achievements.getAchievements, {});
    expect(find(result, "first_log").earned).toBe(true);
    expect(find(result, "github_connected").earned).toBe(true);
    expect(find(result, "wakatime_connected").earned).toBe(true);
    expect(find(result, "leetcode_connected").earned).toBe(true);
    // One day is nowhere near a 7-day streak.
    expect(find(result, "week_streak").earned).toBe(false);
  });

  // Seeded rows are generated demo data — they must not let someone "earn"
  // a streak or a first-log badge without ever having logged for real.
  test("seeded log rows do not count toward any badge", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    for (let i = 0; i < 10; i += 1) {
      await addLog(t, userId, day(-i), { isSeeded: true });
    }

    const result = await asUser.query(api.achievements.getAchievements, {});
    expect(find(result, "first_log").earned).toBe(false);
    expect(find(result, "week_streak").earned).toBe(false);
  });

  test("a seven-day streak earns the week badge but not the month badge", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    for (let i = 0; i < 7; i += 1) {
      await addLog(t, userId, day(-i));
    }

    const result = await asUser.query(api.achievements.getAchievements, {});
    expect(find(result, "week_streak").earned).toBe(true);
    expect(find(result, "month_streak").earned).toBe(false);
    expect(find(result, "month_streak").current).toBe(7);
    expect(find(result, "month_streak").target).toBe(30);
  });

  test("distinct-language count is deduplicated across days", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await addWakatime(t, userId, day(0), 7200, [
      { name: "TypeScript", seconds: 3600 },
      { name: "Python", seconds: 3600 },
    ]);
    // Same two languages again the next day — must not double-count.
    await addWakatime(t, userId, day(-1), 3600, [{ name: "TypeScript", seconds: 3600 }]);

    const result = await asUser.query(api.achievements.getAchievements, {});
    expect(find(result, "polyglot").current).toBe(2);
  });

  test("commits and reviews sum across all days", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await addGithub(t, userId, day(0), { commits: 300, reviews: 6 });
    await addGithub(t, userId, day(-1), { commits: 250, reviews: 5 });

    const result = await asUser.query(api.achievements.getAchievements, {});
    expect(find(result, "prolific_committer").current).toBe(500);
    expect(find(result, "prolific_committer").earned).toBe(true);
    expect(find(result, "reviewer").current).toBe(10);
    expect(find(result, "reviewer").earned).toBe(true);
  });

  // LeetCode's own total, not a sum of daily deltas — deltas can be missing
  // or span a gap (see leetcode.js), but the most recent snapshot's total is
  // always the true lifetime count.
  test("the century-solver badge reads the latest snapshot's total, not a sum", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    // Kept well under the 100 target so a wrong sum (5+8+12=25) and the
    // right answer (12) are both distinguishable from a clamped value.
    await addLeetcode(t, userId, day(-2), 5);
    await addLeetcode(t, userId, day(-1), 8);
    await addLeetcode(t, userId, day(0), 12);

    const result = await asUser.query(api.achievements.getAchievements, {});
    expect(find(result, "century_solver").current).toBe(12);
    expect(find(result, "century_solver").earned).toBe(false);
  });

  test("progress is clamped at the target rather than overshooting", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await addLeetcode(t, userId, day(0), 9000);

    const result = await asUser.query(api.achievements.getAchievements, {});
    expect(find(result, "century_solver").current).toBe(100);
  });
});
