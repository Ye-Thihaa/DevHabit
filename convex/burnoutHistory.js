import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { computeBurnoutRisk } from "./burnout.js";

// One row per (userId, date), snapshotted daily so the burnout score — which
// getBurnoutRisk otherwise only ever reports "as of right now" — has a
// history to chart and, via analytics.buildDataset, to correlate against
// other measured fields like WakaTime hours.

export const snapshotAllUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    const users = await ctx.db.query("users").collect();

    let written = 0;
    for (const user of users) {
      const risk = await computeBurnoutRisk(ctx, user._id);
      // Skip users the score itself declines to rate (not enough logged
      // days) — a null-score row would just be noise in the chart/matrix.
      if (risk.score === null) continue;

      const existing = await ctx.db
        .query("burnoutHistory")
        .withIndex("by_user_and_date", (q) => q.eq("userId", user._id).eq("date", today))
        .unique();

      const row = {
        userId: user._id,
        date: today,
        score: risk.score,
        level: risk.level,
        sampleSize: risk.sampleSize,
        ranAt: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, row);
      } else {
        await ctx.db.insert("burnoutHistory", row);
      }
      written++;
    }
    return written;
  },
});

export const getBurnoutHistory = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, { days = 90 }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const span = Math.min(Math.max(Math.floor(days), 1), 365);
    // by_user_and_date (not just by_user) so "most recent N" is ordered by
    // the actual date field, not insertion order.
    const rows = await ctx.db
      .query("burnoutHistory")
      .withIndex("by_user_and_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(span);

    return rows
      .map((r) => ({ date: r.date, score: r.score, level: r.level, sampleSize: r.sampleSize }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
});
