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
