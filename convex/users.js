import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";

// No auth system yet, so the app identifies a browser by a random
// deviceId it generates and caches in localStorage (see
// useCurrentUser.js), and looks up/creates a user per deviceId here.
// Every device gets its own user and its own private set of logs.
export const getOrCreateDemoUser = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
      .unique();
    if (existing) {
      return existing._id;
    }
    return await ctx.db.insert("users", {
      name: "Demo User",
      email: `${deviceId}@local`,
      deviceId,
    });
  },
});

export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => await ctx.db.get(userId),
});

export const setGithubUsername = mutation({
  args: { userId: v.id("users"), githubUsername: v.string() },
  handler: async (ctx, { userId, githubUsername }) => {
    const trimmed = githubUsername.trim();
    if (!trimmed) {
      throw new ConvexError("GitHub username cannot be empty");
    }
    await ctx.db.patch(userId, { githubUsername: trimmed });
  },
});
