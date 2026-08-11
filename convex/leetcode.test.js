import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { shiftDateString } from "./lib/stats.js";
import { deltaFrom, totalsFrom } from "./leetcode.js";

async function signInAs(t, userId) {
  return t.withIdentity({ subject: userId });
}

async function makeUser(t, fields = {}) {
  return await t.run(async (ctx) => ctx.db.insert("users", fields));
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function profileResponse(counts) {
  return jsonResponse({
    data: {
      matchedUser: {
        username: "someone",
        submitStatsGlobal: {
          acSubmissionNum: [
            { difficulty: "All", count: counts.all },
            { difficulty: "Easy", count: counts.easy },
            { difficulty: "Medium", count: counts.medium },
            { difficulty: "Hard", count: counts.hard },
          ],
        },
      },
    },
  });
}

const TODAY = new Date().toISOString().slice(0, 10);
const day = (offset) => shiftDateString(TODAY, offset);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("totalsFrom", () => {
  test("maps the difficulty list to named totals", () => {
    const totals = totalsFrom([
      { difficulty: "All", count: 120 },
      { difficulty: "Easy", count: 60 },
      { difficulty: "Medium", count: 50 },
      { difficulty: "Hard", count: 10 },
    ]);
    expect(totals).toEqual({ totalSolved: 120, easySolved: 60, mediumSolved: 50, hardSolved: 10 });
  });

  test("missing or empty input is all zeroes, not a crash", () => {
    expect(totalsFrom(undefined)).toEqual({
      totalSolved: 0,
      easySolved: 0,
      mediumSolved: 0,
      hardSolved: 0,
    });
  });
});

describe("deltaFrom", () => {
  const totals = (date, all) => ({
    date,
    totalSolved: all,
    easySolved: Math.floor(all / 2),
    mediumSolved: Math.floor(all / 3),
    hardSolved: all - Math.floor(all / 2) - Math.floor(all / 3),
  });

  // The first-ever snapshot has nothing to compare against — a computed 0
  // would misreport "solved nothing today" for a day that was never measured.
  test("the first snapshot ever has no delta at all", () => {
    const delta = deltaFrom(totals(day(0), 120), null);
    expect(delta).toEqual({});
  });

  test("a clean one-day gap produces a same-day delta", () => {
    const delta = deltaFrom(totals(day(0), 125), totals(day(-1), 120));
    expect(delta).toMatchObject({ solvedToday: 5, daysSincePrevious: 1 });
  });

  test("a multi-day gap is flagged rather than passed off as one day", () => {
    const delta = deltaFrom(totals(day(0), 140), totals(day(-4), 120));
    expect(delta.daysSincePrevious).toBe(4);
    expect(delta.solvedToday).toBe(20);
  });

  // A profile that appears to have solved fewer problems than before (the
  // account was reset, or problems were removed from the site) must not
  // produce a negative "solved" count.
  test("a total that goes down clamps at zero instead of going negative", () => {
    const delta = deltaFrom(totals(day(0), 100), totals(day(-1), 120));
    expect(delta.solvedToday).toBe(0);
  });
});

describe("leetcode.syncNow", () => {
  test("throws without calling fetch when no username is on file", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(asUser.action(api.leetcode.syncNow, {})).rejects.toThrow(
      "Add your LeetCode username in Settings",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("a first sync writes totals with no delta, and records the sync run", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { leetcodeUsername: "octocat" });
    const asUser = await signInAs(t, userId);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(profileResponse({ all: 50, easy: 30, medium: 15, hard: 5 })),
    );

    const result = await asUser.action(api.leetcode.syncNow, {});
    expect(result.totalSolved).toBe(50);
    expect(result.solvedToday).toBeUndefined();

    const runs = await t.run(async (ctx) =>
      ctx.db
        .query("syncRuns")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ kind: "leetcode", status: "ok" });
  });

  test("a second sync the next day produces a same-day delta", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { leetcodeUsername: "octocat" });
    const asUser = await signInAs(t, userId);

    await t.run(async (ctx) => {
      await ctx.db.insert("leetcodeDaily", {
        userId,
        date: day(-1),
        totalSolved: 50,
        easySolved: 30,
        mediumSolved: 15,
        hardSolved: 5,
        fetchedAt: Date.now(),
      });
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(profileResponse({ all: 53, easy: 31, medium: 16, hard: 6 })),
    );

    const result = await asUser.action(api.leetcode.syncNow, {});
    expect(result.solvedToday).toBe(3);
    expect(result.daysSincePrevious).toBe(1);
  });

  test("no matchedUser in the response is a clear error, not a silent zero", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { leetcodeUsername: "nobody-here" });
    const asUser = await signInAs(t, userId);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: { matchedUser: null } })));

    await expect(asUser.action(api.leetcode.syncNow, {})).rejects.toThrow(
      /No public LeetCode profile/,
    );

    const runs = await t.run(async (ctx) =>
      ctx.db
        .query("syncRuns")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(runs[0]).toMatchObject({ status: "error" });
  });

  test("an HTTP failure is surfaced as a ConvexError and recorded", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { leetcodeUsername: "octocat" });
    const asUser = await signInAs(t, userId);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "rate limited" }, { ok: false, status: 429 })),
    );

    await expect(asUser.action(api.leetcode.syncNow, {})).rejects.toThrow(ConvexError);
  });
});

describe("leetcode.snapshotAllConnectedUsers", () => {
  // One user's failure must not stop the rest of the cron from running.
  test("keeps going past one user's failure and reports both outcomes", async () => {
    const t = convexTest(schema);
    const okUser = await makeUser(t, { leetcodeUsername: "good-user" });
    const badUser = await makeUser(t, { leetcodeUsername: "bad-user" });

    const fetchSpy = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.variables.username === "bad-user") {
        return jsonResponse({ error: "nope" }, { ok: false, status: 500 });
      }
      return profileResponse({ all: 10, easy: 10, medium: 0, hard: 0 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await t.action(internal.leetcode.snapshotAllConnectedUsers, {});
    expect(result).toEqual({ users: 2, ok: 1, failed: 1 });

    const okRows = await t.run(async (ctx) =>
      ctx.db
        .query("leetcodeDaily")
        .withIndex("by_user", (q) => q.eq("userId", okUser))
        .collect(),
    );
    expect(okRows).toHaveLength(1);

    const badRuns = await t.run(async (ctx) =>
      ctx.db
        .query("syncRuns")
        .withIndex("by_user", (q) => q.eq("userId", badUser))
        .collect(),
    );
    expect(badRuns[0]).toMatchObject({ status: "error" });
  });

  test("users without a username are skipped, not attempted", async () => {
    const t = convexTest(schema);
    await makeUser(t, {});
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await t.action(internal.leetcode.snapshotAllConnectedUsers, {});
    expect(result).toEqual({ users: 0, ok: 0, failed: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("getLeetcodeSummary", () => {
  test("returns null when signed out", async () => {
    const t = convexTest(schema);
    expect(await t.query(api.leetcode.getLeetcodeSummary, {})).toBeNull();
  });

  test("reports disconnected state when no username is on file", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);

    const result = await asUser.query(api.leetcode.getLeetcodeSummary, {});
    expect(result.connected).toBe(false);
    expect(result.latest).toBeNull();
  });

  // A gap-spanning delta must not be double-counted into the window total —
  // it describes several days, not the one it's stamped with.
  test("only clean one-day deltas are summed into the window total", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { leetcodeUsername: "octocat" });
    const asUser = await signInAs(t, userId);

    await t.run(async (ctx) => {
      await ctx.db.insert("leetcodeDaily", {
        userId,
        date: day(-5),
        totalSolved: 100,
        easySolved: 60,
        mediumSolved: 30,
        hardSolved: 10,
        fetchedAt: Date.now(),
      });
      // Gap of 3 days — solvedToday describes 3 days of work, not 1.
      await ctx.db.insert("leetcodeDaily", {
        userId,
        date: day(-2),
        totalSolved: 106,
        easySolved: 62,
        mediumSolved: 32,
        hardSolved: 12,
        solvedToday: 6,
        daysSincePrevious: 3,
        fetchedAt: Date.now(),
      });
      await ctx.db.insert("leetcodeDaily", {
        userId,
        date: day(-1),
        totalSolved: 108,
        easySolved: 63,
        mediumSolved: 33,
        hardSolved: 12,
        solvedToday: 2,
        daysSincePrevious: 1,
        fetchedAt: Date.now(),
      });
    });

    const result = await asUser.query(api.leetcode.getLeetcodeSummary, { days: 30 });
    expect(result.solvedInWindow).toBe(2);
    expect(result.daysCounted).toBe(1);
    expect(result.snapshots).toBe(3);
    expect(result.latest.totalSolved).toBe(108);
  });
});
