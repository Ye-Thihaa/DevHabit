import { query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const NUMERIC_FIELDS = [
  "codingHours",
  "sleepHours",
  "coffeeIntake",
  "githubCommits",
  "aiToolUsageMinutes",
  "problemsSolved",
  "taskDifficulty",
  "experienceLevel",
  "programmingScore",
];

const MIN_SAMPLE_SIZE = 3;

function fitLinearRegression(xs, ys) {
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((sum, x, i) => sum + x * ys[i], 0);
  const sumX2 = xs.reduce((sum, x) => sum + x * x, 0);
  const sumY2 = ys.reduce((sum, y) => sum + y * y, 0);

  const slopeDenominator = n * sumX2 - sumX * sumX;
  if (slopeDenominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / slopeDenominator;
  const intercept = (sumY - slope * sumX) / n;

  const corrDenominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  const r = corrDenominator === 0 ? null : (n * sumXY - sumX * sumY) / corrDenominator;

  return { slope, intercept, rSquared: r === null ? null : r * r };
}

export const predictOutput = query({
  args: {
    predictorField: v.string(),
    outputField: v.string(),
    plannedValue: v.number(),
  },
  handler: async (ctx, { predictorField, outputField, plannedValue }) => {
    if (!NUMERIC_FIELDS.includes(predictorField) || !NUMERIC_FIELDS.includes(outputField)) {
      throw new ConvexError("Unknown field name");
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { sampleSize: 0, predicted: null, slope: null, intercept: null, rSquared: null };
    }

    const logs = await ctx.db
      .query("dailyLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const sampleSize = logs.length;
    if (sampleSize < MIN_SAMPLE_SIZE) {
      return { sampleSize, predicted: null, slope: null, intercept: null, rSquared: null };
    }

    const xs = logs.map((l) => l[predictorField]);
    const ys = logs.map((l) => l[outputField]);
    const fit = fitLinearRegression(xs, ys);

    if (!fit) {
      return { sampleSize, predicted: null, slope: null, intercept: null, rSquared: null };
    }

    return {
      sampleSize,
      predicted: fit.slope * plannedValue + fit.intercept,
      slope: fit.slope,
      intercept: fit.intercept,
      rSquared: fit.rSquared,
    };
  },
});
