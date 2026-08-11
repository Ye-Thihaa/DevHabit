import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { dateRange, shiftDateString } from "./lib/stats.js";

// Synthetic self-reported data, for demonstrating the analysis before enough
// real days have been logged.
//
// Every row it writes carries isSeeded: true. That flag is respected by the
// whole read path — analytics queries take includeSeeded, the data-quality card
// counts these separately, and the AI summary is told which rows are generated.
// Editing a seeded day through the normal form clears the flag, because at that
// point it is a real observation.
//
// It never touches githubDaily. Fabricating commit counts that claim to have
// come from the GitHub API would make the measured layer meaningless, so the
// objective side stays empty until a real backfill runs.
//
// READ THIS BEFORE QUOTING ANY NUMBER THIS PRODUCES
//
// With linkToGithub the generated effort is derived from the real commit
// counts, so the analysis will find a correlation between coding hours and
// commits. That correlation is a property of the formulas below — it is put
// there on purpose so the pipeline has structure to detect. It is NOT evidence
// about the developer, and it must never be reported as a finding.
//
// What it legitimately demonstrates: that the join, the cleaning, the
// significance testing and the lag analysis work end to end, and that they
// recover a relationship whose true size is known in advance. That is a
// validation result, and a real one. Presenting the same number as an
// observation about how sleep affects output would be fabrication.

// Deterministic PRNG so a given seed reproduces the same dataset — a generated
// figure in the write-up can be regenerated exactly.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

const round = (value, dp = 1) => Number(value.toFixed(dp));

// Seeding is a development affordance, not a product feature. On a production
// deployment there is no legitimate reason to write fabricated days into a real
// account, so the whole facility is opt-in per deployment:
//
//   npx convex env set ALLOW_SEED_DATA true      # dev only, never --prod
//
// Enforced here rather than only in the UI, because hiding a button does not
// remove the mutation — it stays callable from the browser console by anyone
// who opens devtools. The query below lets the dashboard hide the controls;
// the guard is what actually stops the write.
//
// Seeded rows that somehow reach production are still removable, just not from
// the client — see maintenance.clearSeededLogs.
function seedingEnabled() {
  return process.env.ALLOW_SEED_DATA === "true";
}

function requireSeedingEnabled() {
  if (!seedingEnabled()) {
    throw new ConvexError(
      "Seed data is disabled on this deployment. It is a development-only " +
        "facility; set ALLOW_SEED_DATA=true on a dev deployment to use it.",
    );
  }
}

// Drives whether the dashboard renders the seed controls at all.
export const isSeedingEnabled = query({
  args: {},
  handler: async () => seedingEnabled(),
});

export const generateSeedData = mutation({
  args: {
    days: v.optional(v.number()),
    seed: v.optional(v.number()),
    // Refuses to overwrite real rows unless asked; seeded rows are always
    // replaced so the generator is re-runnable.
    overwriteReal: v.optional(v.boolean()),
    // Condition the generated values on that day's real commit count. Without
    // this the self-reported and measured layers are statistically independent,
    // so every self x github correlation comes out at zero and the analysis has
    // nothing to work on.
    linkToGithub: v.optional(v.boolean()),
  },
  handler: async (ctx, { days = 90, seed = 42, overwriteReal = false, linkToGithub = true }) => {
    requireSeedingEnabled();
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not signed in");

    const span = Math.min(Math.max(Math.floor(days), 1), 365);
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = shiftDateString(endDate, -(span - 1));
    const rand = mulberry32(seed);

    // Real commit counts for the window, used to scale the generated effort.
    const githubByDate = new Map();
    if (linkToGithub) {
      const githubRows = await ctx.db
        .query("githubDaily")
        .withIndex("by_user_and_date", (q) =>
          q.eq("userId", userId).gte("date", startDate).lte("date", endDate),
        )
        .collect();
      for (const row of githubRows) githubByDate.set(row.date, row);
    }

    // Scale commits against the busiest day in the window rather than a fixed
    // constant, so the generator adapts to a quiet account and a prolific one.
    const maxCommits = Math.max(1, ...[...githubByDate.values()].map((r) => r.commits ?? 0));

    let written = 0;
    let skippedReal = 0;
    let linkedDays = 0;

    for (const date of dateRange(startDate, endDate)) {
      const existing = await ctx.db
        .query("dailyLogs")
        .withIndex("by_user_and_date", (q) => q.eq("userId", userId).eq("date", date))
        .unique();

      if (existing && existing.isSeeded !== true && !overwriteReal) {
        skippedReal++;
        continue;
      }

      const weekday = new Date(date + "T00:00:00Z").getUTCDay();
      const isWeekend = weekday === 0 || weekday === 6;

      const gh = githubByDate.get(date);
      const commits = gh?.commits ?? 0;
      if (gh) linkedDays++;

      // Normalised measure of how much real work landed that day. Square-rooted
      // because the jump from 0 to 3 commits means far more about whether a day
      // was a working day than the jump from 20 to 23 does.
      const activity = maxCommits > 0 ? Math.sqrt(Math.min(commits, maxCommits) / maxCommits) : 0;

      // Sleep stays largely independent of the commit record — a night's sleep
      // is not caused by the next day's output — but carries a small penalty on
      // heavy days to stand in for late finishes.
      const sleepHours = clamp(7.1 + (rand() - 0.5) * 2.6 - activity * 0.7, 4, 10);
      const energy = clamp((sleepHours - 4) / 6 + (rand() - 0.5) * 0.4, 0, 1);

      // Effort tracks the real commit record, but only loosely. The noise term
      // deliberately dominates enough to land the recovered correlation near
      // r = 0.5-0.6: a tight r = 0.9 would be an obvious tell that the column
      // was computed from the commit count rather than lived.
      //
      // Two uniforms are averaged so the noise is roughly bell-shaped instead
      // of flat, which is what a real day-to-day spread looks like.
      const effortNoise = (rand() + rand() - 1) * 4.4;
      const codingHours = clamp(
        (isWeekend ? 2.0 : 3.0) + activity * 3.4 + energy * 1.2 + effortNoise,
        0,
        14,
      );

      const taskDifficulty = Math.round(clamp(1 + rand() * 4, 1, 5));
      const coffeeIntake = Math.round(clamp(1 + (1 - energy) * 3 + rand(), 0, 8));
      const aiToolUsageMinutes = Math.round(clamp(codingHours * (8 + rand() * 20), 0, 600));
      const problemsSolved = Math.round(
        clamp(codingHours * (0.9 - taskDifficulty * 0.08) + (rand() - 0.5) * 2, 0, 25),
      );
      const programmingScore = Math.round(
        clamp(
          3.8 +
            energy * 2.8 +
            activity * 1.3 +
            (5 - taskDifficulty) * 0.3 +
            (rand() + rand() - 1) * 2.6,
          1,
          10,
        ),
      );

      const row = {
        codingHours: round(codingHours),
        sleepHours: round(sleepHours),
        coffeeIntake,
        aiToolUsageMinutes,
        problemsSolved,
        taskDifficulty,
        experienceLevel: 4,
        programmingScore,
        isSeeded: true,
        updatedAt: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, row);
      } else {
        await ctx.db.insert("dailyLogs", { userId, date, ...row });
      }
      written++;
    }

    return { startDate, endDate, written, skippedReal, seed, linkedDays, linkToGithub };
  },
});

export const clearSeedData = mutation({
  args: {},
  handler: async (ctx) => {
    requireSeedingEnabled();
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not signed in");

    const logs = await ctx.db
      .query("dailyLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let deleted = 0;
    for (const log of logs) {
      if (log.isSeeded === true) {
        await ctx.db.delete(log._id);
        deleted++;
      }
    }
    return { deleted };
  },
});
