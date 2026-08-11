import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { generateText } from "./lib/llm.js";

// Strips the join bookkeeping and keeps provenance flags, so the model is told
// which numbers were measured and which were typed in.
function toPromptRows(rows) {
  return rows.map((row) => ({
    date: row.date,
    selfReported: row.hasSelfReported
      ? {
          codingHours: row.codingHours,
          sleepHours: row.sleepHours,
          coffeeIntake: row.coffeeIntake,
          aiToolUsageMinutes: row.aiToolUsageMinutes,
          problemsSolved: row.problemsSolved,
          taskDifficulty: row.taskDifficulty,
          experienceLevel: row.experienceLevel,
          programmingScore: row.programmingScore,
          isSyntheticSeedData: row.isSeeded,
        }
      : null,
    measuredFromGithub: row.hasGithub
      ? {
          commits: row.commits,
          pullRequestsOpened: row.pullRequestsOpened,
          issuesOpened: row.issuesOpened,
          reviews: row.reviews,
          additions: row.additions,
          deletions: row.deletions,
          reposTouched: row.reposTouched,
          commitsByTimeOfDay: row.commitsByBucket,
        }
      : null,
  }));
}

function buildPrompt(rows, stats) {
  return `You are analyzing one week of a software developer's tracked coding habits.

The data has two provenances and you must respect the difference:
- "selfReported" fields were typed in by the developer. They are subjective and subject to recall bias. A row flagged isSyntheticSeedData: true is GENERATED DEMO DATA — never describe it as something the developer actually did.
- "measuredFromGithub" fields came from the GitHub API. They are objective, but only cover work that reached GitHub — private repos outside the token's scope, non-code work, and local commits are invisible.

Days may be missing on either side; a null means no data, not a zero.

Week's data as JSON:
${JSON.stringify(rows, null, 2)}

Descriptive summary of the same window:
${JSON.stringify(stats, null, 2)}

Write a short, plain-language summary (3-5 sentences) of notable patterns. You may point out relationships between habits and output as observations about this specific week only. Do NOT claim one variable caused another — this is a single week of partly self-reported data, not a controlled experiment. Do not quote a correlation coefficient; the sample is far too small. If the data is too sparse or inconsistent to say anything meaningful, say so plainly instead of speculating.`;
}

function buildMockSummary(rows) {
  const withSelf = rows.filter((r) => r.selfReported);
  const withGh = rows.filter((r) => r.measuredFromGithub);
  const avg = (list, pick) => {
    const values = list.map(pick).filter((v) => typeof v === "number");
    if (values.length === 0) return "n/a";
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  };

  return (
    "[Mock summary — set ANTHROPIC_API_KEY or GROQ_API_KEY on this deployment for a real " +
    "AI-generated one] " +
    `${withSelf.length} day(s) self-reported, ${withGh.length} day(s) with GitHub data. ` +
    `Average coding ${avg(withSelf, (r) => r.selfReported.codingHours)}h, ` +
    `sleep ${avg(withSelf, (r) => r.selfReported.sleepHours)}h, ` +
    `commits ${avg(withGh, (r) => r.measuredFromGithub.commits)}/day.`
  );
}

export const generateWeeklySummary = action({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { startDate, endDate }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not signed in");
    }

    const [dataset, stats] = await Promise.all([
      ctx.runQuery(api.analytics.getDataset, { startDate, endDate }),
      ctx.runQuery(api.analytics.getDescriptiveStats, { startDate, endDate }),
    ]);

    if (dataset.length === 0) {
      throw new ConvexError(
        "No data in that range yet. Back-fill from GitHub or add a daily log first.",
      );
    }

    const rows = toPromptRows(dataset);
    const result = await generateText({
      prompt: buildPrompt(rows, stats.rows),
      maxTokens: 1024,
      label: "summarize this data",
    });
    if (!result) {
      return buildMockSummary(rows);
    }

    return result.text;
  },
});
