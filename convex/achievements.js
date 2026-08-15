import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { streaksFrom } from "./streaks.js";

// Milestones over the same measured/logged data every other card reads —
// nothing new is tracked, this just notices round numbers in it. Computed on
// every read rather than stored, so there is no "achievement earned" write
// path to keep in sync with the underlying data, and no way for a badge to
// go stale relative to the numbers that justify it.
//
// Every threshold here is either a habit (showed up, connected a source) or
// a count of something already measured (commits, hours, problems solved).
// None of them rate skill, for the same reason convex/profile.js doesn't —
// see the header there.

const ACHIEVEMENTS = [
  {
    key: "first_log",
    label: "First entry",
    description: "Logged your first real day.",
    target: 1,
    current: (s) => s.realLogCount,
  },
  {
    key: "week_streak",
    label: "One-week streak",
    description: "Logged seven days in a row at some point.",
    target: 7,
    current: (s) => s.longestStreak,
  },
  {
    key: "month_streak",
    label: "One-month streak",
    description: "Logged thirty days in a row at some point.",
    target: 30,
    current: (s) => s.longestStreak,
  },
  {
    key: "consistent",
    label: "Showed up",
    description: "Logged at least 60 of the last 182 days.",
    target: 60,
    current: (s) => s.daysLoggedInWindow,
  },
  {
    key: "github_connected",
    label: "GitHub synced",
    description: "Backfilled at least one day of commit history.",
    target: 1,
    current: (s) => (s.githubDays > 0 ? 1 : 0),
  },
  {
    key: "wakatime_connected",
    label: "WakaTime synced",
    description: "Synced at least one day of measured coding time.",
    target: 1,
    current: (s) => (s.wakatimeDays > 0 ? 1 : 0),
  },
  {
    key: "leetcode_connected",
    label: "LeetCode synced",
    description: "Connected LeetCode and recorded a snapshot.",
    target: 1,
    current: (s) => (s.leetcodeDays > 0 ? 1 : 0),
  },
  {
    key: "century_solver",
    label: "Century club",
    description: "Solved 100 problems on LeetCode (lifetime total).",
    target: 100,
    current: (s) => s.leetcodeTotalSolved,
  },
  {
    key: "polyglot",
    label: "Polyglot",
    description: "Tracked time in five or more languages.",
    target: 5,
    current: (s) => s.distinctLanguages,
  },
  {
    key: "reviewer",
    label: "Reviewer",
    description: "Reviewed ten or more pull requests — helping other people's code, not just your own.",
    target: 10,
    current: (s) => s.totalReviews,
  },
  {
    key: "prolific_committer",
    label: "Prolific committer",
    description: "500 commits, measured from the GitHub API.",
    target: 500,
    current: (s) => s.totalCommits,
  },
  {
    key: "focused",
    label: "Focused",
    description: "50 hours of measured coding time, tracked by WakaTime.",
    target: 50,
    current: (s) => s.totalCodingHours,
  },
];

export const getAchievements = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const [logs, github, wakatime, leetcode] = await Promise.all([
      ctx.db
        .query("dailyLogs")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("githubDaily")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("wakatimeDaily")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("leetcodeDaily")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    const realLogs = logs.filter((l) => l.isSeeded !== true);
    const today = new Date().toISOString().slice(0, 10);

    const { longest: longestStreak } = streaksFrom(
      realLogs.map((l) => l.date),
      today,
    );

    const calendarStart = new Date(Date.now() - 181 * 86400000).toISOString().slice(0, 10);
    const daysLoggedInWindow = realLogs.filter((l) => l.date >= calendarStart).length;

    const distinctLanguages = new Set();
    let totalCodingSeconds = 0;
    for (const row of wakatime) {
      totalCodingSeconds += row.codingSeconds ?? 0;
      for (const entry of row.languages ?? []) distinctLanguages.add(entry.name);
    }

    const totals = github.reduce(
      (acc, row) => {
        acc.commits += row.commits ?? 0;
        acc.reviews += row.reviews ?? 0;
        return acc;
      },
      { commits: 0, reviews: 0 },
    );

    // The running total as of the most recent snapshot, not a sum of daily
    // deltas — deltas can be missing or gap-spanning (see leetcode.js), but
    // the latest totalSolved is always the true lifetime count.
    const latestLeetcode = [...leetcode].sort((a, b) => a.date.localeCompare(b.date)).at(-1);

    const stats = {
      realLogCount: realLogs.length,
      longestStreak,
      daysLoggedInWindow,
      githubDays: github.length,
      wakatimeDays: wakatime.length,
      leetcodeDays: leetcode.length,
      leetcodeTotalSolved: latestLeetcode?.totalSolved ?? 0,
      distinctLanguages: distinctLanguages.size,
      totalReviews: totals.reviews,
      totalCommits: totals.commits,
      totalCodingHours: totalCodingSeconds / 3600,
    };

    const achievements = ACHIEVEMENTS.map((def) => {
      const current = def.current(stats);
      return {
        key: def.key,
        label: def.label,
        description: def.description,
        target: def.target,
        current: Math.min(current, def.target),
        earned: current >= def.target,
      };
    });

    return {
      earnedCount: achievements.filter((a) => a.earned).length,
      totalCount: achievements.length,
      achievements,
    };
  },
});
