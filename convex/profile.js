import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { mean, shiftDateString } from "./lib/stats.js";

// The "who is this developer" layer. Everything here is descriptive: it
// reports what the measured data already says, and stops there.
//
// Deliberately absent: any inference of skill level. Commit counts, lines
// changed and coding hours do not measure competence — a senior engineer
// often commits less than a beginner, and line counts reward verbosity. The
// signals below are reported as facts about activity so a reader can draw
// their own conclusion; the app does not draw it for them. This is the same
// discipline the rest of the codebase follows (see the header in seed.js).

const DEFAULT_WINDOW_DAYS = 90;

// Rough buckets used only to describe where someone's *time* went. They say
// nothing about ability, and the UI labels them as such.
const FRONTEND = new Set([
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "html",
  "css",
  "scss",
  "sass",
  "less",
  "vue",
  "svelte",
  "astro",
]);
const BACKEND = new Set([
  "python",
  "go",
  "rust",
  "java",
  "kotlin",
  "c#",
  "php",
  "ruby",
  "elixir",
  "scala",
  "c",
  "c++",
  "sql",
]);
const MOBILE = new Set(["swift", "dart", "objective-c", "kotlin"]);
const INFRA = new Set([
  "dockerfile",
  "docker",
  "yaml",
  "hcl",
  "terraform",
  "bash",
  "shell",
  "makefile",
  "nix",
]);

function bucketOf(language) {
  const key = language.toLowerCase();
  if (FRONTEND.has(key)) return "frontend";
  if (MOBILE.has(key)) return "mobile";
  if (BACKEND.has(key)) return "backend";
  if (INFRA.has(key)) return "infra";
  return "other";
}

// Measured by WakaTime, per day, already stored — this just adds it up.
// Nothing here is self-reported, so it needs none of the provenance caveats
// the daily-log fields carry.
export const getLanguageBreakdown = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days = DEFAULT_WINDOW_DAYS }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = shiftDateString(endDate, -(days - 1));

    const rows = await ctx.db
      .query("wakatimeDaily")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", userId).gte("date", startDate).lte("date", endDate),
      )
      .collect();

    const secondsByLanguage = new Map();
    const daysByLanguage = new Map();
    let totalSeconds = 0;

    for (const row of rows) {
      for (const entry of row.languages ?? []) {
        secondsByLanguage.set(entry.name, (secondsByLanguage.get(entry.name) ?? 0) + entry.seconds);
        daysByLanguage.set(entry.name, (daysByLanguage.get(entry.name) ?? 0) + 1);
        totalSeconds += entry.seconds;
      }
    }

    const languages = [...secondsByLanguage.entries()]
      .map(([name, seconds]) => ({
        name,
        seconds,
        hours: seconds / 3600,
        share: totalSeconds > 0 ? seconds / totalSeconds : 0,
        // How many separate days it was touched. A language with 40 hours
        // across 30 days is part of the routine; 40 hours in two days was one
        // project. The share alone can't tell those apart.
        days: daysByLanguage.get(name) ?? 0,
        bucket: bucketOf(name),
      }))
      .sort((a, b) => b.seconds - a.seconds);

    const byBucket = { frontend: 0, backend: 0, mobile: 0, infra: 0, other: 0 };
    for (const language of languages) {
      byBucket[language.bucket] += language.seconds;
    }

    return {
      startDate,
      endDate,
      windowDays: days,
      totalHours: totalSeconds / 3600,
      daysWithData: rows.filter((r) => (r.languages ?? []).length > 0).length,
      languages,
      byBucket,
    };
  },
});

// --- what they build ------------------------------------------------------

// Summarises the repository snapshot. Forks are counted but excluded from the
// language and topic tallies: what someone forked is not what they build, and
// a handful of forked starter templates would otherwise dominate the picture.
export const getRepoProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const repos = await ctx.db
      .query("githubRepos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (repos.length === 0) {
      return { total: 0, owned: 0, forks: 0, languages: [], topics: [], recent: [], syncedAt: null };
    }

    const owned = repos.filter((r) => !r.isFork);

    const countBy = (rows, pick) => {
      const counts = new Map();
      for (const row of rows) {
        for (const value of pick(row)) {
          if (!value) continue;
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
      }
      return [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    };

    const recent = [...owned]
      .sort((a, b) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? ""))
      .slice(0, 6)
      .map((r) => ({
        fullName: r.fullName,
        description: r.description ?? null,
        primaryLanguage: r.primaryLanguage ?? null,
        topics: r.topics.slice(0, 4),
        stars: r.stars,
        isPrivate: r.isPrivate,
        pushedAt: r.pushedAt ?? null,
      }));

    return {
      total: repos.length,
      owned: owned.length,
      forks: repos.length - owned.length,
      languages: countBy(owned, (r) => [r.primaryLanguage]),
      topics: countBy(owned, (r) => r.topics).slice(0, 12),
      recent,
      syncedAt: Math.max(...repos.map((r) => r.fetchedAt)),
    };
  },
});

// --- experience signals ---------------------------------------------------

// Facts, not a verdict. Each entry is something the data actually records,
// phrased so it cannot be mistaken for a rating: "reviewed 40 PRs" is a fact,
// "senior" is a claim this data cannot support.
//
// The self-rated level rides along separately and is labelled as the user's
// own answer, because that is exactly what it is.
export const getExperienceSignals = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const [user, github, wakatime, logs] = await Promise.all([
      ctx.db.get(userId),
      ctx.db
        .query("githubDaily")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("wakatimeDaily")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("dailyLogs")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    const activeDates = github.filter((g) => g.commits > 0).map((g) => g.date).sort();
    const firstActive = activeDates[0] ?? null;
    const lastActive = activeDates.at(-1) ?? null;

    const languageNames = new Set();
    for (const row of wakatime) {
      for (const entry of row.languages ?? []) languageNames.add(entry.name);
    }

    const totals = github.reduce(
      (acc, row) => {
        acc.commits += row.commits ?? 0;
        acc.reviews += row.reviews ?? 0;
        acc.pullRequests += row.pullRequestsOpened ?? 0;
        acc.repos = Math.max(acc.repos, row.reposTouched ?? 0);
        return acc;
      },
      { commits: 0, reviews: 0, pullRequests: 0, repos: 0 },
    );

    // Only counts days the data actually covers, so a short sync window
    // doesn't read as a short career.
    const observedSpanDays =
      firstActive && lastActive
        ? Math.round(
            (new Date(`${lastActive}T00:00:00Z`).getTime() -
              new Date(`${firstActive}T00:00:00Z`).getTime()) /
              86400000,
          ) + 1
        : 0;

    const realLogs = logs.filter((l) => l.isSeeded !== true);
    const selfRated = realLogs.length > 0 ? realLogs.at(-1).experienceLevel ?? null : null;

    return {
      observedSpanDays,
      firstActiveDate: firstActive,
      lastActiveDate: lastActive,
      activeDays: activeDates.length,
      distinctLanguages: languageNames.size,
      languageNames: [...languageNames],
      totalCommits: totals.commits,
      totalReviews: totals.reviews,
      totalPullRequests: totals.pullRequests,
      reposTouched: totals.repos,
      // The user's own answer on the daily-log form, most recent real entry.
      // Presented as self-reported, never blended into anything computed.
      selfRatedExperience: selfRated,
      selfRatedFrom: realLogs.length > 0 ? realLogs.at(-1).date : null,
    };
  },
});

// --- productivity index ---------------------------------------------------

// An index against *your own* recent baseline, not against other developers —
// the app has no data about anyone else, so an absolute or comparative score
// would be invented. 100 means "same as your prior 28 days"; 130 means half
// again as much output on these signals.
//
// Rule-based and fully decomposed for the same reason the burnout score is:
// there is no labelled "was this a productive week" outcome to train on, so a
// heuristic that shows its arithmetic is more honest than a model that would
// be fitting noise.
const PRODUCTIVITY_WINDOW_DAYS = 14;
const MIN_DAYS_FOR_PRODUCTIVITY = 7;

const PRODUCTIVITY_SIGNALS = [
  { key: "commits", label: "Commits", weight: 1 },
  { key: "codingHours", label: "Coding hours", weight: 1 },
  { key: "problemsSolved", label: "Problems solved", weight: 1 },
  { key: "shipped", label: "PRs and reviews", weight: 1 },
];

function windowTotals(rows) {
  const value = (key) => rows.map((r) => r[key]).filter((v) => typeof v === "number");
  return {
    commits: mean(value("commits")),
    codingHours: mean(value("codingHours")),
    problemsSolved: mean(value("problemsSolved")),
    shipped: mean(
      rows
        .filter((r) => typeof r.pullRequestsOpened === "number" || typeof r.reviews === "number")
        .map((r) => (r.pullRequestsOpened ?? 0) + (r.reviews ?? 0)),
    ),
  };
}

export const getProductivityIndex = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const today = new Date().toISOString().slice(0, 10);
    const recentStart = shiftDateString(today, -(PRODUCTIVITY_WINDOW_DAYS - 1));
    const priorEnd = shiftDateString(recentStart, -1);
    const priorStart = shiftDateString(priorEnd, -(PRODUCTIVITY_WINDOW_DAYS - 1));

    const dataset = await ctx.runQuery(api.analytics.getDataset, {
      startDate: priorStart,
      endDate: today,
      includeSeeded: false,
    });

    const recent = dataset.filter((r) => r.date >= recentStart);
    const prior = dataset.filter((r) => r.date >= priorStart && r.date <= priorEnd);

    if (recent.length < MIN_DAYS_FOR_PRODUCTIVITY || prior.length < MIN_DAYS_FOR_PRODUCTIVITY) {
      return {
        index: null,
        reason: "insufficient-data",
        minDays: MIN_DAYS_FOR_PRODUCTIVITY,
        recentDays: recent.length,
        priorDays: prior.length,
        windowDays: PRODUCTIVITY_WINDOW_DAYS,
        components: [],
      };
    }

    const recentTotals = windowTotals(recent);
    const priorTotals = windowTotals(prior);

    const components = [];
    for (const signal of PRODUCTIVITY_SIGNALS) {
      const now = recentTotals[signal.key];
      const before = priorTotals[signal.key];
      const available = Number.isFinite(now) && Number.isFinite(before) && before > 0;
      components.push({
        key: signal.key,
        label: signal.label,
        recent: Number.isFinite(now) ? now : null,
        prior: Number.isFinite(before) ? before : null,
        // Capped so one signal quadrupling can't drag the whole index with it.
        ratio: available ? Math.min(now / before, 3) : null,
        available,
      });
    }

    const usable = components.filter((c) => c.available);
    if (usable.length === 0) {
      return {
        index: null,
        reason: "no-baseline",
        minDays: MIN_DAYS_FOR_PRODUCTIVITY,
        recentDays: recent.length,
        priorDays: prior.length,
        windowDays: PRODUCTIVITY_WINDOW_DAYS,
        components,
      };
    }

    const index = Math.round(mean(usable.map((c) => c.ratio)) * 100);

    return {
      index,
      reason: null,
      windowDays: PRODUCTIVITY_WINDOW_DAYS,
      recentDays: recent.length,
      priorDays: prior.length,
      signalsUsed: usable.length,
      signalsTotal: PRODUCTIVITY_SIGNALS.length,
      components,
    };
  },
});
