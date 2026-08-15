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

async function addWakatime(t, userId, date, codingSeconds) {
  await t.run(async (ctx) => {
    await ctx.db.insert("wakatimeDaily", { userId, date, codingSeconds, fetchedAt: Date.now() });
  });
}

async function addLeetcode(t, userId, date, solvedToday, daysSincePrevious = 1) {
  await t.run(async (ctx) => {
    await ctx.db.insert("leetcodeDaily", {
      userId,
      date,
      totalSolved: 100,
      easySolved: 60,
      mediumSolved: 30,
      hardSolved: 10,
      solvedToday,
      daysSincePrevious,
      fetchedAt: Date.now(),
    });
  });
}

describe("getAccuracyReport", () => {
  test("returns null when signed out", async () => {
    const t = convexTest(schema);
    expect(await t.query(api.accuracy.getAccuracyReport, {})).toBeNull();
  });

  test("reports insufficient data below the minimum overlap", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await addLog(t, userId, day(0), { codingHours: 4 });
    await addWakatime(t, userId, day(0), 4 * 3600);

    const result = await asUser.query(api.accuracy.getAccuracyReport, {});
    expect(result.codingHours.available).toBe(false);
    expect(result.codingHours.sampleSize).toBe(1);
  });

  // The headline case: someone who consistently logs more hours than
  // WakaTime actually measured should show up as a positive bias.
  test("detects a systematic overestimate in self-reported coding hours", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    for (let i = 0; i < 10; i += 1) {
      const date = day(-i);
      await addLog(t, userId, date, { codingHours: 6 });
      await addWakatime(t, userId, date, 4 * 3600); // measured is always 2h less
    }

    const result = await asUser.query(api.accuracy.getAccuracyReport, {});
    expect(result.codingHours.available).toBe(true);
    expect(result.codingHours.sampleSize).toBe(10);
    expect(result.codingHours.meanSelf).toBeCloseTo(6, 5);
    expect(result.codingHours.meanMeasured).toBeCloseTo(4, 5);
    expect(result.codingHours.meanBias).toBeCloseTo(2, 5);
    expect(result.codingHours.biasPercent).toBeCloseTo(50, 5);
    expect(result.codingHours.meanAbsoluteError).toBeCloseTo(2, 5);
  });

  test("detects a systematic underestimate", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    for (let i = 0; i < 10; i += 1) {
      const date = day(-i);
      await addLog(t, userId, date, { codingHours: 3 });
      await addWakatime(t, userId, date, 5 * 3600);
    }

    const result = await asUser.query(api.accuracy.getAccuracyReport, {});
    expect(result.codingHours.meanBias).toBeCloseTo(-2, 5);
    expect(result.codingHours.biasPercent).toBeCloseTo(-40, 5);
  });

  test("a perfect self-assessor shows zero bias and a clean correlation", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    const hours = [2, 3, 4, 5, 6, 7, 3, 5, 4, 6];
    for (let i = 0; i < hours.length; i += 1) {
      const date = day(-i);
      await addLog(t, userId, date, { codingHours: hours[i] });
      await addWakatime(t, userId, date, hours[i] * 3600);
    }

    const result = await asUser.query(api.accuracy.getAccuracyReport, {});
    expect(result.codingHours.meanBias).toBeCloseTo(0, 5);
    expect(result.codingHours.meanAbsoluteError).toBeCloseTo(0, 5);
    expect(result.codingHours.correlation).toBeCloseTo(1, 5);
  });

  // A WakaTime zero means "not measured yet" everywhere else in the app —
  // it must not be treated as ground truth here either.
  test("a WakaTime zero is not counted as a measurement", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    for (let i = 0; i < 10; i += 1) {
      const date = day(-i);
      await addLog(t, userId, date, { codingHours: 4 });
      await addWakatime(t, userId, date, 0);
    }

    const result = await asUser.query(api.accuracy.getAccuracyReport, {});
    expect(result.codingHours.available).toBe(false);
    expect(result.codingHours.sampleSize).toBe(0);
  });

  // A LeetCode delta spanning several days is not a same-day comparison and
  // must be excluded, exactly like it is from the window total in
  // leetcode.getLeetcodeSummary.
  test("a multi-day LeetCode delta is excluded from the comparison", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    for (let i = 0; i < 10; i += 1) {
      const date = day(-i);
      await addLog(t, userId, date, { problemsSolved: 2 });
      await addLeetcode(t, userId, date, 5, i === 5 ? 3 : 1);
    }

    const result = await asUser.query(api.accuracy.getAccuracyReport, {});
    expect(result.problemsSolved.sampleSize).toBe(9);
  });

  test("seeded self-reported rows are excluded", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    for (let i = 0; i < 10; i += 1) {
      const date = day(-i);
      await addLog(t, userId, date, { codingHours: 4, isSeeded: true });
      await addWakatime(t, userId, date, 4 * 3600);
    }

    const result = await asUser.query(api.accuracy.getAccuracyReport, {});
    expect(result.codingHours.available).toBe(false);
    expect(result.codingHours.sampleSize).toBe(0);
  });

  test("coding hours and problems solved are tracked independently", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    for (let i = 0; i < 10; i += 1) {
      const date = day(-i);
      await addLog(t, userId, date, { codingHours: 4, problemsSolved: 2 });
      await addWakatime(t, userId, date, 4 * 3600);
      // No LeetCode data at all — problemsSolved must stay unavailable
      // without affecting the codingHours result.
    }

    const result = await asUser.query(api.accuracy.getAccuracyReport, {});
    expect(result.codingHours.available).toBe(true);
    expect(result.problemsSolved.available).toBe(false);
  });
});
