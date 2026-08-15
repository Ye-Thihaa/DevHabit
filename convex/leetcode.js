import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { shiftDateString } from "./lib/stats.js";

// Problems solved, measured rather than remembered.
//
// dailyLogs.problemsSolved is self-reported — typed in from memory, usually
// after the fact. This reads the same quantity from LeetCode's public profile
// so the analysis has an objective version of it.
//
// THE IMPORTANT LIMITATION, up front: LeetCode publishes no per-day history of
// *solved* problems. The profile exposes running totals, and a submission
// calendar that counts submissions (including failed ones and repeats), which
// is a different quantity. So daily figures here are produced by snapshotting
// the totals once a day and differencing consecutive snapshots. That means:
//
//   - nothing can be back-filled; the series starts the day a user connects
//   - the first row has no delta at all, and says so rather than claiming 0
//   - a missed day produces one delta spanning the gap, flagged with
//     daysSincePrevious so it is never mistaken for a single day's work
//
// This is an unofficial endpoint. It needs no key and no login — the data is
// public — but it can change or rate-limit without notice, so every failure is
// recorded in syncRuns and swallowed by the cron rather than thrown.

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

const PROFILE_QUERY = `
  query userProblemsSolved($username: String!) {
    matchedUser(username: $username) {
      username
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
        }
      }
    }
  }
`;

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

// Turns the API's [{difficulty, count}] list into named totals. "All" is
// reported by LeetCode itself rather than summed here, because it counts a
// problem once regardless of how many times it was solved.
export function totalsFrom(acSubmissionNum) {
  const byDifficulty = new Map(
    (acSubmissionNum ?? []).map((entry) => [String(entry.difficulty).toLowerCase(), entry.count]),
  );
  return {
    totalSolved: byDifficulty.get("all") ?? 0,
    easySolved: byDifficulty.get("easy") ?? 0,
    mediumSolved: byDifficulty.get("medium") ?? 0,
    hardSolved: byDifficulty.get("hard") ?? 0,
  };
}

// Deltas against the previous snapshot. Exported for tests: this is where the
// "snapshot and difference" idea either holds up or quietly lies.
export function deltaFrom(totals, previous) {
  if (!previous) {
    // First ever snapshot. There is no previous total, so there is no honest
    // daily figure — a 0 here would read as "solved nothing today", and a
    // totalSolved here would read as "solved 247 problems today".
    return {};
  }
  const gapDays = Math.max(
    1,
    Math.round(
      (new Date(`${totals.date}T00:00:00Z`).getTime() -
        new Date(`${previous.date}T00:00:00Z`).getTime()) /
        86400000,
    ),
  );
  // Totals can only go up. A decrease means the profile changed under us
  // (problems removed, account reset) — clamping at 0 avoids a negative
  // "solved" count polluting every statistic downstream.
  const diff = (now, before) => Math.max(0, now - before);
  return {
    solvedToday: diff(totals.totalSolved, previous.totalSolved),
    easyToday: diff(totals.easySolved, previous.easySolved),
    mediumToday: diff(totals.mediumSolved, previous.mediumSolved),
    hardToday: diff(totals.hardSolved, previous.hardSolved),
    daysSincePrevious: gapDays,
  };
}

async function fetchProfile(username) {
  let response;
  try {
    response = await fetch(LEETCODE_GRAPHQL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // LeetCode rejects requests without a browser-ish Referer.
        Referer: `https://leetcode.com/${username}/`,
        "User-Agent": "devhabit (coding-habit tracker)",
      },
      body: JSON.stringify({ query: PROFILE_QUERY, variables: { username } }),
    });
  } catch (err) {
    throw new ConvexError(`Could not reach LeetCode: ${err.message}`);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ConvexError(`LeetCode error (${response.status}): ${text.slice(0, 200)}`);
  }

  const payload = await response.json();
  // GraphQL answers 200 with an errors array, so a bad username is not an
  // HTTP failure — it has to be checked explicitly.
  const user = payload?.data?.matchedUser;
  if (!user) {
    throw new ConvexError(
      `No public LeetCode profile for "${username}". Check the username, and that the profile is not private.`,
    );
  }

  return totalsFrom(user.submitStatsGlobal?.acSubmissionNum);
}

export const writeSnapshot = internalMutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    totalSolved: v.number(),
    easySolved: v.number(),
    mediumSolved: v.number(),
    hardSolved: v.number(),
  },
  handler: async (ctx, { userId, date, ...totals }) => {
    const previousRows = await ctx.db
      .query("leetcodeDaily")
      .withIndex("by_user_and_date", (q) => q.eq("userId", userId).lt("date", date))
      .collect();
    const previous = previousRows.sort((a, b) => a.date.localeCompare(b.date)).at(-1) ?? null;

    const delta = deltaFrom({ ...totals, date }, previous);
    const row = { userId, date, ...totals, ...delta, fetchedAt: Date.now() };

    const existing = await ctx.db
      .query("leetcodeDaily")
      .withIndex("by_user_and_date", (q) => q.eq("userId", userId).eq("date", date))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, row);
    } else {
      await ctx.db.insert("leetcodeDaily", row);
    }
    return { date, ...totals, ...delta };
  },
});

export const recordSyncRun = internalMutation({
  args: {
    userId: v.id("users"),
    status: v.union(v.literal("ok"), v.literal("error")),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { userId, status, message }) => {
    const today = todayString();
    await ctx.db.insert("syncRuns", {
      userId,
      kind: "leetcode",
      startDate: today,
      endDate: today,
      daysWritten: status === "ok" ? 1 : 0,
      status,
      ...(message ? { message } : {}),
      ranAt: Date.now(),
    });
  },
});

export const getUsernameFor = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    return user?.leetcodeUsername ?? null;
  },
});

export const listConnectedUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => typeof u.leetcodeUsername === "string" && u.leetcodeUsername.length > 0)
      .map((u) => ({ userId: u._id, username: u.leetcodeUsername }));
  },
});

// User-triggered. Throws so the settings form can show why it failed.
export const syncNow = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not signed in");

    const username = await ctx.runQuery(internal.leetcode.getUsernameFor, { userId });
    if (!username) {
      throw new ConvexError("Add your LeetCode username in Settings before syncing.");
    }

    try {
      const totals = await fetchProfile(username);
      const result = await ctx.runMutation(internal.leetcode.writeSnapshot, {
        userId,
        date: todayString(),
        ...totals,
      });
      await ctx.runMutation(internal.leetcode.recordSyncRun, { userId, status: "ok" });
      return result;
    } catch (err) {
      const message = err instanceof ConvexError ? String(err.data) : `Sync failed: ${err.message}`;
      await ctx.runMutation(internal.leetcode.recordSyncRun, {
        userId,
        status: "error",
        message: message.slice(0, 300),
      });
      throw err instanceof ConvexError ? err : new ConvexError(message);
    }
  },
});

// Cron path. One user's failure must not abort the rest, so each is caught
// and recorded rather than thrown.
export const snapshotAllConnectedUsers = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.leetcode.listConnectedUsers, {});
    let ok = 0;
    let failed = 0;

    for (const { userId, username } of users) {
      try {
        const totals = await fetchProfile(username);
        await ctx.runMutation(internal.leetcode.writeSnapshot, {
          userId,
          date: todayString(),
          ...totals,
        });
        await ctx.runMutation(internal.leetcode.recordSyncRun, { userId, status: "ok" });
        ok++;
      } catch (err) {
        failed++;
        await ctx.runMutation(internal.leetcode.recordSyncRun, {
          userId,
          status: "error",
          message: String(err instanceof ConvexError ? err.data : err.message).slice(0, 300),
        });
      }
    }

    return { users: users.length, ok, failed };
  },
});

// --- read ------------------------------------------------------------------

export const getLeetcodeSummary = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days = 30 }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    const username = user?.leetcodeUsername ?? null;

    const endDate = todayString();
    const startDate = shiftDateString(endDate, -(days - 1));

    const rows = await ctx.db
      .query("leetcodeDaily")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", userId).gte("date", startDate).lte("date", endDate),
      )
      .collect();

    const sorted = rows.sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted.at(-1) ?? null;

    // Only rows that represent a single day are summed. A delta spanning a
    // gap describes several days at once and would inflate the window.
    const cleanDeltas = sorted.filter(
      (r) => typeof r.solvedToday === "number" && r.daysSincePrevious === 1,
    );

    return {
      username,
      connected: Boolean(username),
      windowDays: days,
      latest: latest
        ? {
            date: latest.date,
            totalSolved: latest.totalSolved,
            easySolved: latest.easySolved,
            mediumSolved: latest.mediumSolved,
            hardSolved: latest.hardSolved,
          }
        : null,
      solvedInWindow: cleanDeltas.reduce((sum, r) => sum + r.solvedToday, 0),
      daysCounted: cleanDeltas.length,
      snapshots: sorted.length,
      series: sorted.map((r) => ({
        date: r.date,
        solved: r.solvedToday ?? null,
        spansDays: r.daysSincePrevious ?? null,
      })),
    };
  },
});
