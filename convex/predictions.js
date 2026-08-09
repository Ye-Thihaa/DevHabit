import { query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { FIELD_BY_KEY, isKnownField } from "./lib/fields.js";
import { linearRegression, predictionMargin, shiftDateString } from "./lib/stats.js";
import { ALPHA, MIN_SAMPLE_FOR_REGRESSION } from "./lib/thresholds.js";

// Single-predictor OLS over the user's own history.
//
// The previous version returned a bare point estimate and an R². That reads as
// far more certain than 30-odd self-reported days can support, so this returns
// the slope's standard error and p-value, a 95% prediction interval, and an
// explicit flag for whether the relationship is distinguishable from no
// relationship at all.

// Same join as analytics.buildDataset. Kept local because Convex queries can't
// call each other directly and the shape needed here is narrow.
async function buildPairs(ctx, userId, predictorField, outcomeField, lag) {
  const [logs, github] = await Promise.all([
    ctx.db
      .query("dailyLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("githubDaily")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
  ]);

  const rows = new Map();
  const ensure = (date) => {
    if (!rows.has(date)) rows.set(date, { date });
    return rows.get(date);
  };

  for (const log of logs) {
    Object.assign(ensure(log.date), {
      codingHours: log.codingHours,
      sleepHours: log.sleepHours,
      coffeeIntake: log.coffeeIntake,
      aiToolUsageMinutes: log.aiToolUsageMinutes,
      problemsSolved: log.problemsSolved,
      taskDifficulty: log.taskDifficulty,
      experienceLevel: log.experienceLevel,
      programmingScore: log.programmingScore,
      isSeeded: log.isSeeded === true,
    });
  }
  for (const gh of github) {
    Object.assign(ensure(gh.date), {
      commits: gh.commits,
      pullRequestsOpened: gh.pullRequestsOpened,
      issuesOpened: gh.issuesOpened,
      reviews: gh.reviews,
      additions: gh.additions ?? null,
      deletions: gh.deletions ?? null,
      reposTouched: gh.reposTouched ?? null,
      nightCommits: gh.commitsByBucket?.night ?? null,
    });
  }

  const xs = [];
  const ys = [];
  let seededPairs = 0;

  for (const [date, row] of rows) {
    const outcomeRow = lag === 0 ? row : rows.get(shiftDateString(date, lag));
    if (!outcomeRow) continue;
    const x = row[predictorField];
    const y = outcomeRow[outcomeField];
    if (typeof x !== "number" || typeof y !== "number") continue;
    xs.push(x);
    ys.push(y);
    if (row.isSeeded || outcomeRow.isSeeded) seededPairs++;
  }

  return { xs, ys, seededPairs };
}

const emptyResult = (sampleSize, reason) => ({
  sampleSize,
  predicted: null,
  low: null,
  high: null,
  slope: null,
  intercept: null,
  rSquared: null,
  slopeP: null,
  slopeSe: null,
  significant: false,
  seededPairs: 0,
  reason,
});

export const predictOutput = query({
  args: {
    predictorField: v.string(),
    outputField: v.string(),
    plannedValue: v.number(),
    // Predict the outcome this many days *after* the predictor. Sleep on
    // Monday against Tuesday's commits is lag 1.
    lag: v.optional(v.number()),
  },
  handler: async (ctx, { predictorField, outputField, plannedValue, lag = 0 }) => {
    if (!isKnownField(predictorField) || !isKnownField(outputField)) {
      throw new ConvexError("Unknown field name");
    }
    if (predictorField === outputField && lag === 0) {
      throw new ConvexError("Predictor and outcome must differ at lag 0");
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) return emptyResult(0, "not-signed-in");

    const boundedLag = Math.min(Math.max(Math.floor(lag), 0), 7);
    const { xs, ys, seededPairs } = await buildPairs(
      ctx,
      userId,
      predictorField,
      outputField,
      boundedLag,
    );

    if (xs.length < MIN_SAMPLE_FOR_REGRESSION) {
      return {
        ...emptyResult(xs.length, "insufficient-data"),
        minSample: MIN_SAMPLE_FOR_REGRESSION,
      };
    }

    const fit = linearRegression(xs, ys);
    if (!fit) {
      return { ...emptyResult(xs.length, "no-variation"), minSample: MIN_SAMPLE_FOR_REGRESSION };
    }

    const predicted = fit.slope * plannedValue + fit.intercept;
    const margin = predictionMargin(fit, plannedValue);
    const outDef = FIELD_BY_KEY[outputField];

    // Clamp the interval to the field's own floor — a negative commit count is
    // arithmetically fine and physically meaningless.
    const clamp = (value) => {
      if (value === null) return null;
      if (outDef.min !== undefined && value < outDef.min) return outDef.min;
      if (outDef.max !== undefined && value > outDef.max) return outDef.max;
      return value;
    };

    // Was the planned value inside the range the model was fitted on? Outside
    // it the line is extrapolation, and the interval understates the risk.
    const observedMin = Math.min(...xs);
    const observedMax = Math.max(...xs);

    return {
      sampleSize: xs.length,
      lag: boundedLag,
      predicted: clamp(predicted),
      low: margin === null ? null : clamp(predicted - margin),
      high: margin === null ? null : clamp(predicted + margin),
      slope: fit.slope,
      intercept: fit.intercept,
      rSquared: fit.rSquared,
      slopeSe: fit.slopeSe,
      slopeP: fit.slopeP,
      significant: fit.slopeP !== null && fit.slopeP < ALPHA,
      alpha: ALPHA,
      seededPairs,
      extrapolating: plannedValue < observedMin || plannedValue > observedMax,
      observedRange: { min: observedMin, max: observedMax },
      predictorSource: FIELD_BY_KEY[predictorField].source,
      outputSource: outDef.source,
      minSample: MIN_SAMPLE_FOR_REGRESSION,
      reason: null,
    };
  },
});
