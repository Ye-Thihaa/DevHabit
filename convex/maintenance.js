import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Destructive maintenance, kept as internalMutation so it can only be invoked
// deliberately from the CLI — never from the client.
//
// Take a snapshot first:  npx convex export --path backups/<name>.zip

// Deletes every data row belonging to one user across all three layers.
//
// The users row itself and the Convex Auth tables are left alone on purpose:
// removing an account's auth records mid-session invalidates tokens in ways
// that are awkward to recover from, and an orphaned profile row with no data
// costs nothing.
export const purgeUserData = internalMutation({
  args: {
    userId: v.id("users"),
    // Guard against a mistyped id silently wiping the wrong account.
    confirmGithubUsername: v.string(),
  },
  handler: async (ctx, { userId, confirmGithubUsername }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error(`No user with id ${userId}`);
    }
    if (user.githubUsername !== confirmGithubUsername) {
      throw new Error(
        `Refusing to purge: user ${userId} has githubUsername "${user.githubUsername}", ` +
          `but "${confirmGithubUsername}" was passed as confirmation.`,
      );
    }

    const deleted = { dailyLogs: 0, githubDaily: 0, syncRuns: 0 };

    for (const table of ["dailyLogs", "githubDaily", "syncRuns"]) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
        deleted[table]++;
      }
    }

    return { userId, githubUsername: user.githubUsername, deleted };
  },
});
