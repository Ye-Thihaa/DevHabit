import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api } from "./_generated/api";

const MODEL = "claude-opus-5";

function buildPrompt(logs) {
  return `You are analyzing a software developer's self-tracked daily habit logs for one week. Each entry has: date, codingHours, sleepHours, coffeeIntake, githubCommits, aiToolUsageMinutes, problemsSolved, taskDifficulty (1-5), experienceLevel (1-5), programmingScore (1-10).

Here is the week's data as JSON:
${JSON.stringify(logs, null, 2)}

Write a short, plain-language summary (3-5 sentences) of notable patterns in this data. You may point out relationships between habits (sleep, coffee, coding hours, AI tool usage) and output (commits, problems solved) as observations about this specific week only. Do not claim that one variable caused another — this is a single week of self-reported data, not a controlled experiment. If the data is too sparse or inconsistent to say anything meaningful, say so plainly instead of speculating.`;
}

function buildMockSummary(logs) {
  const avg = (field) => (logs.reduce((sum, l) => sum + l[field], 0) / logs.length).toFixed(1);
  return (
    "[Mock summary — set ANTHROPIC_API_KEY on this deployment for a real AI-generated one] " +
    `Over ${logs.length} logged day(s), you averaged ${avg("codingHours")}h of coding, ` +
    `${avg("sleepHours")}h of sleep, and solved ${avg("problemsSolved")} problem(s) per day, ` +
    `with ${avg("githubCommits")} GitHub commit(s) per day on average.`
  );
}

export const generateWeeklySummary = action({
  args: {
    userId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { userId, startDate, endDate }) => {
    const logs = await ctx.runQuery(api.dailyLogs.getLogsInRange, {
      userId,
      startDate,
      endDate,
    });

    if (logs.length === 0) {
      throw new ConvexError("No logs in that date range yet.");
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return buildMockSummary(logs);
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        output_config: { effort: "low" },
        messages: [{ role: "user", content: buildPrompt(logs) }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ConvexError(`Claude API error (${response.status}): ${text}`);
    }

    const data = await response.json();

    if (data.stop_reason === "refusal") {
      throw new ConvexError("Claude declined to summarize this data.");
    }

    const textBlock = data.content.find((block) => block.type === "text");
    if (!textBlock) {
      throw new ConvexError("Claude returned no text content.");
    }

    return textBlock.text;
  },
});
