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

async function addWakatime(t, userId, date, languages) {
  await t.run(async (ctx) => {
    await ctx.db.insert("wakatimeDaily", {
      userId,
      date,
      codingSeconds: languages.reduce((sum, l) => sum + l.seconds, 0),
      languages,
      fetchedAt: Date.now(),
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

async function addLog(t, userId, date, fields = {}) {
  await t.run(async (ctx) => {
    await ctx.db.insert("dailyLogs", {
      userId,
      date,
      codingHours: 4,
      sleepHours: 7,
      coffeeIntake: 1,
      aiToolUsageMinutes: 0,
      problemsSolved: 2,
      taskDifficulty: 2,
      experienceLevel: 3,
      programmingScore: 5,
      ...fields,
    });
  });
}

describe("getLanguageBreakdown", () => {
  test("returns null when signed out", async () => {
    const t = convexTest(schema);
    expect(await t.query(api.profile.getLanguageBreakdown, {})).toBeNull();
  });

  test("sums seconds per language across days and computes shares", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await addWakatime(t, userId, day(0), [
      { name: "TypeScript", seconds: 3600 },
      { name: "Python", seconds: 1800 },
    ]);
    await addWakatime(t, userId, day(-1), [{ name: "TypeScript", seconds: 1800 }]);

    const result = await asUser.query(api.profile.getLanguageBreakdown, { days: 30 });

    expect(result.totalHours).toBeCloseTo(2, 5);
    expect(result.languages[0].name).toBe("TypeScript");
    expect(result.languages[0].hours).toBeCloseTo(1.5, 5);
    expect(result.languages[0].share).toBeCloseTo(0.75, 5);
    // Touched on two separate days — distinguishes a routine from one binge.
    expect(result.languages[0].days).toBe(2);
    expect(result.languages[1].days).toBe(1);
  });

  test("groups languages into where-the-time-went buckets", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await addWakatime(t, userId, day(0), [
      { name: "TypeScript", seconds: 3600 },
      { name: "Go", seconds: 1800 },
      { name: "Dockerfile", seconds: 600 },
      { name: "Brainfuck", seconds: 60 },
    ]);

    const result = await asUser.query(api.profile.getLanguageBreakdown, { days: 30 });
    expect(result.byBucket.frontend).toBe(3600);
    expect(result.byBucket.backend).toBe(1800);
    expect(result.byBucket.infra).toBe(600);
    expect(result.byBucket.other).toBe(60);
  });

  test("an empty history is zeroes, not a crash", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    const result = await asUser.query(api.profile.getLanguageBreakdown, {});
    expect(result.totalHours).toBe(0);
    expect(result.languages).toEqual([]);
  });
});

describe("getExperienceSignals", () => {
  test("reports facts about activity and never a skill label", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await addGithub(t, userId, day(-100), { commits: 2, reviews: 1 });
    await addGithub(t, userId, day(-1), { commits: 5, reviews: 3, pullRequestsOpened: 2 });
    await addWakatime(t, userId, day(-1), [
      { name: "TypeScript", seconds: 3600 },
      { name: "Rust", seconds: 600 },
    ]);

    const result = await asUser.query(api.profile.getExperienceSignals, {});

    expect(result.observedSpanDays).toBe(100);
    expect(result.activeDays).toBe(2);
    expect(result.totalCommits).toBe(7);
    expect(result.totalReviews).toBe(4);
    expect(result.distinctLanguages).toBe(2);
    // The contract that matters: no verdict field exists to be misread.
    expect(result).not.toHaveProperty("level");
    expect(result).not.toHaveProperty("seniority");
  });

  test("self-rated experience is carried through untouched, with its date", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await addLog(t, userId, day(-1), { experienceLevel: 4 });

    const result = await asUser.query(api.profile.getExperienceSignals, {});
    expect(result.selfRatedExperience).toBe(4);
    expect(result.selfRatedFrom).toBe(day(-1));
  });

  // Seeded rows are generated, so a demo dataset must not supply the user's
  // own self-rating.
  test("seeded logs do not supply the self-rating", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await addLog(t, userId, day(-1), { experienceLevel: 5, isSeeded: true });

    const result = await asUser.query(api.profile.getExperienceSignals, {});
    expect(result.selfRatedExperience).toBeNull();
  });
});

describe("getProductivityIndex", () => {
  test("refuses to score without enough days on both sides", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await addLog(t, userId, day(0));

    const result = await asUser.query(api.profile.getProductivityIndex, {});
    expect(result.index).toBeNull();
    expect(result.reason).toBe("insufficient-data");
  });

  test("an unchanged fortnight scores 100 — the baseline is you", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    for (let i = 0; i < 28; i += 1) {
      await addLog(t, userId, day(-i), { problemsSolved: 2 });
      await addGithub(t, userId, day(-i), { commits: 3, reviews: 1 });
    }

    const result = await asUser.query(api.profile.getProductivityIndex, {});
    expect(result.index).toBe(100);
  });

  test("doubling output across every signal reads as 200", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    for (let i = 0; i < 28; i += 1) {
      const recent = i < 14;
      await addLog(t, userId, day(-i), {
        problemsSolved: recent ? 4 : 2,
        codingHours: recent ? 8 : 4,
      });
      await addGithub(t, userId, day(-i), {
        commits: recent ? 6 : 3,
        reviews: recent ? 2 : 1,
      });
    }

    const result = await asUser.query(api.profile.getProductivityIndex, {});
    expect(result.index).toBe(200);
    expect(result.components.every((c) => c.available)).toBe(true);
  });

  // One signal exploding shouldn't let the headline number run away.
  test("a single runaway signal is capped at 3x", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    for (let i = 0; i < 28; i += 1) {
      const recent = i < 14;
      await addLog(t, userId, day(-i), { problemsSolved: 2, codingHours: 4 });
      await addGithub(t, userId, day(-i), { commits: recent ? 300 : 3, reviews: 1 });
    }

    const result = await asUser.query(api.profile.getProductivityIndex, {});
    const commits = result.components.find((c) => c.key === "commits");
    expect(commits.ratio).toBe(3);
    // (3 + 1 + 1 + 1) / 4 = 1.5
    expect(result.index).toBe(150);
  });
});
