import { mutation, query, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";

const NUMERIC_FIELDS = [
  "codingHours",
  "sleepHours",
  "coffeeIntake",
  "githubCommits",
  "aiToolUsageMinutes",
  "problemsSolved",
  "taskDifficulty",
  "experienceLevel",
  "programmingScore",
];

function assertValidRanges(fields) {
  if (
    fields.taskDifficulty !== undefined &&
    (fields.taskDifficulty < 1 || fields.taskDifficulty > 5)
  ) {
    throw new ConvexError("taskDifficulty must be between 1 and 5");
  }
  if (
    fields.experienceLevel !== undefined &&
    (fields.experienceLevel < 1 || fields.experienceLevel > 5)
  ) {
    throw new ConvexError("experienceLevel must be between 1 and 5");
  }
  if (
    fields.programmingScore !== undefined &&
    (fields.programmingScore < 1 || fields.programmingScore > 10)
  ) {
    throw new ConvexError("programmingScore must be between 1 and 10");
  }
}

function shiftDateString(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function pearsonCorrelation(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((sum, x, i) => sum + x * ys[i], 0);
  const sumX2 = xs.reduce((sum, x) => sum + x * x, 0);
  const sumY2 = ys.reduce((sum, y) => sum + y * y, 0);
  const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  if (denominator === 0) return null;
  return (n * sumXY - sumX * sumY) / denominator;
}

export const addDailyLog = mutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    codingHours: v.number(),
    sleepHours: v.number(),
    coffeeIntake: v.number(),
    githubCommits: v.number(),
    aiToolUsageMinutes: v.number(),
    problemsSolved: v.number(),
    taskDifficulty: v.number(),
    experienceLevel: v.number(),
    programmingScore: v.number(),
  },
  handler: async (ctx, args) => {
    assertValidRanges(args);
    const existing = await ctx.db
      .query("dailyLogs")
      .withIndex("by_user_and_date", (q) => q.eq("userId", args.userId).eq("date", args.date))
      .unique();
    if (existing) {
      throw new ConvexError(`A log for ${args.date} already exists`);
    }
    return await ctx.db.insert("dailyLogs", args);
  },
});

export const updateDailyLog = mutation({
  args: {
    userId: v.id("users"),
    logId: v.id("dailyLogs"),
    date: v.optional(v.string()),
    codingHours: v.optional(v.number()),
    sleepHours: v.optional(v.number()),
    coffeeIntake: v.optional(v.number()),
    githubCommits: v.optional(v.number()),
    aiToolUsageMinutes: v.optional(v.number()),
    problemsSolved: v.optional(v.number()),
    taskDifficulty: v.optional(v.number()),
    experienceLevel: v.optional(v.number()),
    programmingScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, logId, ...updates } = args;
    assertValidRanges(updates);
    const existing = await ctx.db.get(logId);
    if (!existing) {
      throw new ConvexError("Log not found");
    }
    if (existing.userId !== userId) {
      throw new ConvexError("Not authorized to modify this log");
    }
    await ctx.db.patch(logId, updates);
    return logId;
  },
});

// Called by the github.syncGithubCommits action to write back a fetched
// commit count. Internal because it isn't meant to be called directly
// by clients (they go through the action, which validates the GitHub
// username first).
export const setGithubCommits = internalMutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    githubCommits: v.number(),
  },
  handler: async (ctx, { userId, date, githubCommits }) => {
    const existing = await ctx.db
      .query("dailyLogs")
      .withIndex("by_user_and_date", (q) => q.eq("userId", userId).eq("date", date))
      .unique();
    if (!existing) {
      throw new ConvexError(`No log entry for ${date} yet. Create one first.`);
    }
    await ctx.db.patch(existing._id, { githubCommits });
  },
});

export const getLogsInRange = query({
  args: {
    userId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { userId, startDate, endDate }) => {
    return await ctx.db
      .query("dailyLogs")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", userId).gte("date", startDate).lte("date", endDate),
      )
      .collect();
  },
});

export const getRollingAverages = query({
  args: {
    userId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { userId, startDate, endDate }) => {
    const bufferStart = shiftDateString(startDate, -6);
    const logs = await ctx.db
      .query("dailyLogs")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", userId).gte("date", bufferStart).lte("date", endDate),
      )
      .collect();

    return logs
      .filter((log) => log.date >= startDate)
      .map((log) => {
        const windowStart = shiftDateString(log.date, -6);
        const window = logs.filter((l) => l.date >= windowStart && l.date <= log.date);
        const averages = {};
        for (const field of NUMERIC_FIELDS) {
          averages[field] = window.reduce((sum, l) => sum + l[field], 0) / window.length;
        }
        return { date: log.date, sampleSize: window.length, averages };
      });
  },
});

export const getCorrelationMatrix = query({
  args: {
    userId: v.id("users"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, { userId, startDate, endDate }) => {
    const logs = await ctx.db
      .query("dailyLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const filtered = logs.filter(
      (log) =>
        (startDate === undefined || log.date >= startDate) &&
        (endDate === undefined || log.date <= endDate),
    );

    const matrix = {};
    for (const fieldA of NUMERIC_FIELDS) {
      matrix[fieldA] = {};
      for (const fieldB of NUMERIC_FIELDS) {
        matrix[fieldA][fieldB] = pearsonCorrelation(
          filtered.map((l) => l[fieldA]),
          filtered.map((l) => l[fieldB]),
        );
      }
    }
    return { sampleSize: filtered.length, matrix };
  },
});
