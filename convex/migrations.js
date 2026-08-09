import { internalMutation } from "./_generated/server";

// One-off migration for the schema change that split dailyLogs (which used to
// hold a self-reported `githubCommits` number) into a self-reported table and a
// measured `githubDaily` table.
//
// For each existing log it moves githubCommits into a githubDaily row tagged
// detailLevel: "migrated" — that tag matters, because those counts were typed
// in by hand and are not equivalent to numbers the GitHub API returned. Rows
// that were bulk-inserted (many within the same few seconds) are flagged
// isSeeded so they can't be passed off as real observations later.
//
// Run once with:  npx convex run migrations:splitGithubFromDailyLogs
// It is idempotent — re-running skips logs that already have a githubDaily row.

// Logs created within this window of each other were written by a script, not
// typed in one day at a time.
const BULK_INSERT_WINDOW_MS = 60_000;

export const splitGithubFromDailyLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const logs = await ctx.db.query("dailyLogs").collect();

    // Group by user so "bulk inserted" is judged per account.
    const byUser = new Map();
    for (const log of logs) {
      const key = log.userId;
      if (!byUser.has(key)) byUser.set(key, []);
      byUser.get(key).push(log);
    }

    let movedCommits = 0;
    let flaggedSeeded = 0;
    let strippedField = 0;

    for (const [userId, userLogs] of byUser) {
      const times = userLogs.map((l) => l._creationTime).sort((a, b) => a - b);
      const span = times.length > 1 ? times[times.length - 1] - times[0] : Infinity;
      const looksBulkInserted = userLogs.length > 2 && span < BULK_INSERT_WINDOW_MS;

      for (const log of userLogs) {
        const legacyCommits = log.githubCommits;

        if (typeof legacyCommits === "number") {
          const existing = await ctx.db
            .query("githubDaily")
            .withIndex("by_user_and_date", (q) => q.eq("userId", userId).eq("date", log.date))
            .unique();

          if (!existing) {
            await ctx.db.insert("githubDaily", {
              userId,
              date: log.date,
              commits: legacyCommits,
              pullRequestsOpened: 0,
              issuesOpened: 0,
              reviews: 0,
              detailLevel: "migrated",
              fetchedAt: log._creationTime,
            });
            movedCommits++;
          }
        }

        const patch = {};
        if (legacyCommits !== undefined) {
          // Convex removes a field when it is patched to undefined.
          patch.githubCommits = undefined;
          strippedField++;
        }
        if (looksBulkInserted && log.isSeeded !== true) {
          patch.isSeeded = true;
          flaggedSeeded++;
        }
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(log._id, patch);
        }
      }

      if (userLogs.length > 0) {
        const dates = userLogs.map((l) => l.date).sort();
        await ctx.db.insert("syncRuns", {
          userId,
          kind: "migration",
          startDate: dates[0],
          endDate: dates[dates.length - 1],
          daysWritten: movedCommits,
          status: "ok",
          message: looksBulkInserted
            ? "Legacy self-reported commit counts moved to githubDaily; source logs flagged as seeded (bulk-inserted)."
            : "Legacy self-reported commit counts moved to githubDaily.",
          ranAt: Date.now(),
        });
      }
    }

    return { logsScanned: logs.length, movedCommits, flaggedSeeded, strippedField };
  },
});
