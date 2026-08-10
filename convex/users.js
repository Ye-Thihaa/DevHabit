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
