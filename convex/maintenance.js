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

// The escape hatch for a deployment where seeding is disabled (production).
// seed.clearSeedData refuses to run there, so if seeded rows ever do reach
// production — imported, or written while the flag was briefly on — this is
// how they come out:
//
//   npx convex run --prod maintenance:clearSeededLogs '{"userId":"..."}'
//
// Only ever deletes rows carrying isSeeded: true, so it cannot touch a real
// entry even if pointed at the wrong account. Omitting userId sweeps every
// user, which is the usual case when cleaning a deployment.
export const clearSeededLogs = internalMutation({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, { userId }) => {
    const logs = userId
      ? await ctx.db
          .query("dailyLogs")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect()
      : await ctx.db.query("dailyLogs").collect();

    let deleted = 0;
    for (const log of logs) {
      if (log.isSeeded === true) {
        await ctx.db.delete(log._id);
        deleted++;
      }
    }
    return { scanned: logs.length, deleted };
  },
});
