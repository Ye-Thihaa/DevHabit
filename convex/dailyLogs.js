import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { FIELD_BY_KEY, SELF_FIELDS } from "./lib/fields.js";

// The self-reported layer. Commit counts used to live here as a typed-in
// number; they are measured now and live in githubDaily, written only by
// convex/github.js. Keeping the two apart is what lets the analysis say which
// side of a correlation is subjective.

function assertValidRanges(fields) {
  for (const key of SELF_FIELDS) {
    const value = fields[key];
    if (value === undefined) continue;

    const def = FIELD_BY_KEY[key];
    if (!Number.isFinite(value)) {
      throw new ConvexError(`${def.label} must be a number`);
    }
    if (def.min !== undefined && value < def.min) {
      throw new ConvexError(`${def.label} must be ${def.min} or more`);
    }
    if (def.max !== undefined && value > def.max) {
      throw new ConvexError(`${def.label} must be ${def.max} or less`);
    }
    if (def.scale && !Number.isInteger(value)) {
      throw new ConvexError(`${def.label} must be a whole number`);
    }
  }
}

function assertValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ConvexError("Date must be in YYYY-MM-DD format");
  }
  const today = new Date().toISOString().slice(0, 10);
  if (date > today) {
    throw new ConvexError("Cannot log a day that hasn't happened yet");
  }
}

async function requireUserId(ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Not signed in");
  }
  return userId;
}

const selfReportedArgs = {
  // Optional: once WakaTime is connected the form stops collecting this at
  // all (see src/routes/log.tsx) and analytics.buildDataset prefers the
  // measured figure anyway.
  codingHours: v.optional(v.number()),
  sleepHours: v.number(),
  coffeeIntake: v.number(),
  aiToolUsageMinutes: v.number(),
  // Optional: once LeetCode is connected the form stops collecting this at
  // all (see src/routes/log.tsx), same as codingHours above for WakaTime.
  problemsSolved: v.optional(v.number()),
  taskDifficulty: v.number(),
  experienceLevel: v.number(),
  programmingScore: v.number(),
};

// Upsert rather than insert-or-error. The old behaviour rejected a second
// submission for the same date, which made correcting a typo impossible
// without going through the database directly.
export const saveDailyLog = mutation({
  args: {
    date: v.string(),
    ...selfReportedArgs,
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    assertValidDate(args.date);
    assertValidRanges(args);

    const existing = await ctx.db
      .query("dailyLogs")
      .withIndex("by_user_and_date", (q) => q.eq("userId", userId).eq("date", args.date))
      .unique();

    if (existing) {
      // An edited row is no longer synthetic, whatever it started as.
      await ctx.db.patch(existing._id, { ...args, isSeeded: false, updatedAt: Date.now() });
      return { logId: existing._id, created: false };
    }

    const logId = await ctx.db.insert("dailyLogs", {
      ...args,
      userId,
      isSeeded: false,
      updatedAt: Date.now(),
    });
    return { logId, created: true };
  },
});

export const updateDailyLog = mutation({
  args: {
    logId: v.id("dailyLogs"),
    codingHours: v.optional(v.number()),
    sleepHours: v.optional(v.number()),
    coffeeIntake: v.optional(v.number()),
    aiToolUsageMinutes: v.optional(v.number()),
    problemsSolved: v.optional(v.number()),
    taskDifficulty: v.optional(v.number()),
    experienceLevel: v.optional(v.number()),
    programmingScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { logId, ...updates } = args;
    assertValidRanges(updates);

    const existing = await ctx.db.get(logId);
    if (!existing) {
      throw new ConvexError("Log not found");
    }
    if (existing.userId !== userId) {
      throw new ConvexError("Not authorized to modify this log");
    }

    await ctx.db.patch(logId, { ...updates, isSeeded: false, updatedAt: Date.now() });
    return logId;
  },
});

export const deleteDailyLog = mutation({
  args: { logId: v.id("dailyLogs") },
  handler: async (ctx, { logId }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(logId);
    if (!existing) {
      throw new ConvexError("Log not found");
    }
    if (existing.userId !== userId) {
      throw new ConvexError("Not authorized to delete this log");
    }
    await ctx.db.delete(logId);
  },
});

// Raw self-reported rows. Most of the UI reads analytics.getDataset instead,
// which joins these to the measured layer.
export const getLogsInRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { startDate, endDate }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("dailyLogs")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", userId).gte("date", startDate).lte("date", endDate),
      )
      .collect();
  },
});

export const getLogForDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("dailyLogs")
      .withIndex("by_user_and_date", (q) => q.eq("userId", userId).eq("date", date))
      .unique();
  },
});
