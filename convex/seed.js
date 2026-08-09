import { mutation } from "./_generated/server";
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

export const generateSeedData = mutation({
  args: {
    days: v.optional(v.number()),
    seed: v.optional(v.number()),
    // Refuses to overwrite real rows unless asked; seeded rows are always
    // replaced so the generator is re-runnable.
    overwriteReal: v.optional(v.boolean()),
  },
  handler: async (ctx, { days = 90, seed = 42, overwriteReal = false }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not signed in");

    const span = Math.min(Math.max(Math.floor(days), 1), 365);
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = shiftDateString(endDate, -(span - 1));
    const rand = mulberry32(seed);

    let written = 0;
    let skippedReal = 0;

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

      // Not pure noise: sleep drives the next-day-ish energy, energy drives
      // coding hours and score, difficulty suppresses problems solved. The
      // relationships are real inside the generated data, which is the point —
      // it lets the analysis pipeline be checked against a known answer.
      const sleepHours = clamp(7 + (rand() - 0.5) * 3, 4, 10);
      const energy = clamp((sleepHours - 4) / 6 + (rand() - 0.5) * 0.4, 0, 1);
      const codingHours = clamp((isWeekend ? 2.5 : 5.5) * (0.6 + energy * 0.8), 0, 14);
      const taskDifficulty = Math.round(clamp(1 + rand() * 4, 1, 5));
      const coffeeIntake = Math.round(clamp(1 + (1 - energy) * 3 + rand(), 0, 8));
      const aiToolUsageMinutes = Math.round(clamp(codingHours * (8 + rand() * 20), 0, 600));
      const problemsSolved = Math.round(
        clamp(codingHours * (0.9 - taskDifficulty * 0.08) + (rand() - 0.5), 0, 25),
      );
      const programmingScore = Math.round(
        clamp(4 + energy * 4 + (5 - taskDifficulty) * 0.4 + (rand() - 0.5), 1, 10),
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

    return { startDate, endDate, written, skippedReal, seed };
  },
});

export const clearSeedData = mutation({
  args: {},
  handler: async (ctx) => {
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
