import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mean, pearson, shiftDateString } from "./lib/stats.js";
import { MIN_PAIRS_FOR_CORRELATION } from "./lib/thresholds.js";

// How well self-reported numbers track the measured ones, on the days that
// happen to have both.
//
// Once WakaTime/LeetCode is connected, analytics.buildDataset stops asking
// "which figure do I show" as a live question — the measured value simply
// wins, and the original self-reported number disappears from the joined
// row (see the codingHoursSource/problemsSolvedSource comments there). That
// is the right behavior for the analysis, but it means the joined dataset
// can never answer "how far off was I usually?" — the two numbers are never
// in the same row.
//
// This queries the raw tables directly instead, so both sides of a day
// survive: dailyLogs still has whatever the user typed on a day that a sync
// later back-filled a measurement for. Overlap is rare — the daily-log form
// stops asking for a field the moment a source connects, so most of this
// history comes from data logged before that day, or from a WakaTime/
// LeetCode backfill that reached back over days that were already logged by
// hand. That rarity is fine: this is a diagnostic about self-perception, not
// a statistic anything else in the app depends on.
//
// Only "clean" measured values count as the truth to compare against, for
// the same reasons buildDataset already established:
//   - a WakaTime day with codingSeconds === 0 is "not measured yet", not
//     "measured as zero" (see analytics.js)
//   - a LeetCode delta spanning more than one day describes several days at
//     once, not the one it's stamped with (see leetcode.js)
const MIN_DAYS_FOR_ACCURACY = 5;

function summarize(pairs) {
  if (pairs.length < MIN_DAYS_FOR_ACCURACY) {
    return { available: false, sampleSize: pairs.length, minDays: MIN_DAYS_FOR_ACCURACY };
  }

  const selfValues = pairs.map((p) => p.self);
  const measuredValues = pairs.map((p) => p.measured);
  const errors = pairs.map((p) => p.self - p.measured);
  const absErrors = errors.map(Math.abs);

  const meanSelf = mean(selfValues);
  const meanMeasured = mean(measuredValues);
  const meanBias = mean(errors);
  const meanAbsoluteError = mean(absErrors);
  const { r, n, p } = pearson(selfValues, measuredValues);
  const underpowered = n < MIN_PAIRS_FOR_CORRELATION;

  return {
    available: true,
    sampleSize: pairs.length,
    meanSelf,
    meanMeasured,
    // Positive: self-reports run high on average (overestimate). Negative:
    // self-reports run low (underestimate). This is a signed mean, not a
    // mean of absolute values, so it can only say "biased toward more/less
    // on average" — it does not say every individual day was off.
    meanBias,
    biasPercent: meanMeasured > 0 ? (meanBias / meanMeasured) * 100 : null,
    meanAbsoluteError,
    // How consistently self-reports move with the measured value, separate
    // from whether the scale matches. A high r with a large bias reads as
    // "off by a steady amount" rather than "unreliable".
    correlation: r,
    correlationSignificant: !underpowered && r !== null && p !== null && p < 0.05,
  };
}

export const getAccuracyReport = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days = 90 }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = shiftDateString(endDate, -(days - 1));

    const [logs, wakatime, leetcode] = await Promise.all([
      ctx.db
        .query("dailyLogs")
        .withIndex("by_user_and_date", (q) =>
          q.eq("userId", userId).gte("date", startDate).lte("date", endDate),
        )
        .collect(),
      ctx.db
        .query("wakatimeDaily")
        .withIndex("by_user_and_date", (q) =>
          q.eq("userId", userId).gte("date", startDate).lte("date", endDate),
        )
        .collect(),
      ctx.db
        .query("leetcodeDaily")
        .withIndex("by_user_and_date", (q) =>
          q.eq("userId", userId).gte("date", startDate).lte("date", endDate),
        )
        .collect(),
    ]);

    // Generated demo data was never actually experienced by the user, so it
    // cannot say anything about how they perceive their own days.
    const realLogs = logs.filter((l) => l.isSeeded !== true);
    const logByDate = new Map(realLogs.map((l) => [l.date, l]));
    const wtByDate = new Map(wakatime.map((w) => [w.date, w]));
    const lcByDate = new Map(leetcode.map((l) => [l.date, l]));

    const codingHoursPairs = [];
    const problemsSolvedPairs = [];

    for (const [date, log] of logByDate) {
      if (typeof log.codingHours === "number") {
        const wt = wtByDate.get(date);
        if (wt && wt.codingSeconds > 0) {
          codingHoursPairs.push({ date, self: log.codingHours, measured: wt.codingSeconds / 3600 });
        }
      }
      if (typeof log.problemsSolved === "number") {
        const lc = lcByDate.get(date);
        if (lc && lc.daysSincePrevious === 1 && typeof lc.solvedToday === "number") {
          problemsSolvedPairs.push({ date, self: log.problemsSolved, measured: lc.solvedToday });
        }
      }
    }

    return {
      windowDays: days,
      codingHours: summarize(codingHoursPairs),
      problemsSolved: summarize(problemsSolvedPairs),
    };
  },
});
