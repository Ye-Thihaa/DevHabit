import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// The signed-in user's own profile, or null if not signed in. githubUsername
// is normally populated automatically on first GitHub sign-in (see
// convex/auth.ts); this just reads whatever is on the user record.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

export const setGithubUsername = mutation({
  args: { githubUsername: v.string() },
  handler: async (ctx, { githubUsername }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not signed in");
    }
    const trimmed = githubUsername.trim();
    if (!trimmed) {
      throw new ConvexError("GitHub username cannot be empty");
    }
    await ctx.db.patch(userId, { githubUsername: trimmed });
  },
});

export const setWakatimeApiKey = mutation({
  args: { wakatimeApiKey: v.string() },
  handler: async (ctx, { wakatimeApiKey }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not signed in");
    }
    const trimmed = wakatimeApiKey.trim();
    if (!trimmed) {
      throw new ConvexError("WakaTime API key cannot be empty");
    }
    await ctx.db.patch(userId, { wakatimeApiKey: trimmed });
  },
});

export const clearWakatimeApiKey = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not signed in");
    }
    await ctx.db.patch(userId, { wakatimeApiKey: undefined });
  },
});

// Bounds are generous on purpose — this is a personal target, not a
// validated measurement, and the app has no business telling someone their
// goal is wrong. They exist to catch a typo (700 hours of sleep) that would
// otherwise render as a broken-looking progress bar forever.
const GOAL_LIMITS = {
  codingHours: { min: 0, max: 24 },
  sleepHours: { min: 0, max: 24 },
  commits: { min: 0, max: 200 },
};

// Passing null for a field clears it, which is different from omitting the
// field — omitting leaves whatever was there alone.
export const setGoals = mutation({
  args: {
    codingHours: v.optional(v.union(v.number(), v.null())),
    sleepHours: v.optional(v.union(v.number(), v.null())),
    commits: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not signed in");
    }

    const user = await ctx.db.get(userId);
    const goals = { ...(user?.goals ?? {}) };

    for (const [key, limits] of Object.entries(GOAL_LIMITS)) {
      const value = args[key];
      if (value === undefined) continue;
      if (value === null) {
        delete goals[key];
        continue;
      }
      if (!Number.isFinite(value) || value < limits.min || value > limits.max) {
        throw new ConvexError(`${key} goal must be between ${limits.min} and ${limits.max}`);
      }
      goals[key] = value;
    }

    // An all-empty object would read as "goals are configured" downstream,
    // so it collapses back to undefined instead.
    await ctx.db.patch(userId, {
      goals: Object.keys(goals).length > 0 ? goals : undefined,
    });
  },
});

// Records the browser's UTC offset so commit timestamps can be bucketed by the
// developer's own clock rather than UTC. Called automatically on the dashboard;
// see the note on users.timezoneOffsetMinutes in schema.js for the sign
// convention.
export const setTimezoneOffset = mutation({
  args: { timezoneOffsetMinutes: v.number() },
  handler: async (ctx, { timezoneOffsetMinutes }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not signed in");
    }
    // Real offsets span UTC-12:00 to UTC+14:00.
    if (timezoneOffsetMinutes < -720 || timezoneOffsetMinutes > 840) {
      throw new ConvexError("Timezone offset out of range");
    }
    await ctx.db.patch(userId, { timezoneOffsetMinutes });
  },
});
