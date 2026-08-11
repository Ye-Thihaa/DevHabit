import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

async function signInAs(t, userId) {
  return t.withIdentity({ subject: userId });
}

async function makeUser(t) {
  return await t.run(async (ctx) => ctx.db.insert("users", {}));
}

const TODAY = new Date().toISOString().slice(0, 10);

async function seededLogCount(t) {
  return await t.run(async (ctx) => {
    const logs = await ctx.db.query("dailyLogs").collect();
    return logs.filter((l) => l.isSeeded === true).length;
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("seeding guard", () => {
  test("is reported as disabled when the flag is unset", async () => {
    vi.stubEnv("ALLOW_SEED_DATA", "");
    const t = convexTest(schema);
    expect(await t.query(api.seed.isSeedingEnabled, {})).toBe(false);
  });

  test("is reported as enabled only for the exact string 'true'", async () => {
    const t = convexTest(schema);

    vi.stubEnv("ALLOW_SEED_DATA", "true");
    expect(await t.query(api.seed.isSeedingEnabled, {})).toBe(true);

    // A stray "1"/"yes" must not quietly switch it on in production.
    vi.stubEnv("ALLOW_SEED_DATA", "1");
    expect(await t.query(api.seed.isSeedingEnabled, {})).toBe(false);
  });

  // The button is hidden in the UI, but the mutation is public — this is the
  // check that actually stops a console call on a production deployment.
  test("generateSeedData refuses to write when disabled", async () => {
    vi.stubEnv("ALLOW_SEED_DATA", "");
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await expect(asUser.mutation(api.seed.generateSeedData, { days: 5 })).rejects.toThrow(
      "Seed data is disabled on this deployment",
    );
    expect(await seededLogCount(t)).toBe(0);
  });

  test("clearSeedData refuses to run when disabled", async () => {
    vi.stubEnv("ALLOW_SEED_DATA", "");
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await expect(asUser.mutation(api.seed.clearSeedData, {})).rejects.toThrow(
      "Seed data is disabled on this deployment",
    );
  });

  test("generateSeedData still works on a deployment that opts in", async () => {
    vi.stubEnv("ALLOW_SEED_DATA", "true");
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    const result = await asUser.mutation(api.seed.generateSeedData, {
      days: 5,
      linkToGithub: false,
    });
    expect(result.written).toBe(5);
    expect(await seededLogCount(t)).toBe(5);
  });

  test("the guard runs before the auth check, so it cannot be probed by signing in", async () => {
    vi.stubEnv("ALLOW_SEED_DATA", "");
    const t = convexTest(schema);
    await expect(t.mutation(api.seed.generateSeedData, { days: 5 })).rejects.toThrow(
      "Seed data is disabled on this deployment",
    );
  });
});

describe("maintenance.clearSeededLogs", () => {
  // The CLI escape hatch for production, where clearSeedData is blocked.
  test("deletes only seeded rows and leaves real entries alone", async () => {
    vi.stubEnv("ALLOW_SEED_DATA", "true");
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    await asUser.mutation(api.seed.generateSeedData, { days: 4, linkToGithub: false });
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

    // Disabled, exactly as production would be — the internal path still works.
    vi.stubEnv("ALLOW_SEED_DATA", "");
    const result = await t.mutation(
      (await import("./_generated/api")).internal.maintenance.clearSeededLogs,
      {},
    );

    expect(result.deleted).toBeGreaterThan(0);
    expect(await seededLogCount(t)).toBe(0);

    const remaining = await t.run(async (ctx) => ctx.db.query("dailyLogs").collect());
    expect(remaining).toHaveLength(1);
    expect(remaining[0].isSeeded).toBeUndefined();
  });
});
