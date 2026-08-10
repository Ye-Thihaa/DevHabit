import { query, action } from "./_generated/server";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mean, shiftDateString } from "./lib/stats.js";
import { MIN_DAYS_FOR_BURNOUT } from "./lib/thresholds.js";

const ASSESSMENT_MODEL = "claude-opus-5";

// A rule-based burnout risk score, not a trained model — there's no labeled
// "was this person burned out" outcome anywhere in the dataset to train
// against, so a heuristic that shows its work is more honest than a model
// that would just be fitting noise.
//
// Compares a recent window to the window immediately before it, on four
// signals every one of which is already tracked. Each signal is normalized
// to 0..1 "how much does this look like burnout" and averaged into a 0..100
// score. Every component reports its own before/after numbers so the UI can
// say *why*, not just *what*.

const WINDOW_DAYS = 14;

// How large a swing in each signal counts as "fully" burnout-shaped. These
// are judgement calls, tuned to be generous rather than alarmist — a single
// bad week shouldn't max out the score.
const SLEEP_DROP_FOR_MAX_RISK = 2; // hours
const HOURS_UP_FOR_MAX_RISK = 2; // hours/day increase
const COMMITS_DOWN_FOR_MAX_RISK = 3; // commits/day decrease
const NIGHT_SHARE_UP_FOR_MAX_RISK = 0.3; // fraction-of-commits increase
const DIFFICULTY_UP_FOR_MAX_RISK = 1.5; // 1-5 scale
const COFFEE_UP_FOR_MAX_RISK = 2; // cups/day increase

// Maps a raw delta to a 0..1 risk contribution. `direction` is +1 when an
// increase is the risk signal, -1 when a decrease is.
function normalize(delta, span, direction) {
  const risk = (direction * delta) / span;
  return Math.max(0, Math.min(1, risk));
}

async function buildWindowRows(ctx, userId, startDate, endDate) {
  const [logs, github, wakatime] = await Promise.all([
    ctx.db
      .query("dailyLogs")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", userId).gte("date", startDate).lte("date", endDate),
      )
      .collect(),
    ctx.db
      .query("githubDaily")
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
  ]);

  const rows = new Map();
  const ensure = (date) => {
    if (!rows.has(date)) rows.set(date, { date });
    return rows.get(date);
  };

  for (const log of logs) {
    Object.assign(ensure(log.date), {
      hasLog: true,
      codingHours: log.codingHours,
      sleepHours: log.sleepHours,
      coffeeIntake: log.coffeeIntake,
      taskDifficulty: log.taskDifficulty,
    });
  }
  for (const gh of github) {
    Object.assign(ensure(gh.date), {
      commits: gh.commits,
      nightCommits: gh.commitsByBucket?.night ?? 0,
      totalBucketed: gh.commitsByBucket
        ? gh.commitsByBucket.night +
          gh.commitsByBucket.morning +
          gh.commitsByBucket.afternoon +
          gh.commitsByBucket.evening
        : 0,
    });
  }
  for (const wt of wakatime) {
    // WakaTime's measured hours supersede the self-reported figure — but
    // only when it actually measured something. The summaries endpoint
    // returns codingSeconds: 0 for every day in range, including days
    // before the plugin was installed, so a zero can't be told apart from
    // "wasn't tracked" — treat it as no measurement rather than a confident
    // zero that would wipe out real self-reported history.
    if (wt.codingSeconds > 0) {
      ensure(wt.date).codingHours = wt.codingSeconds / 3600;
    }
  }

  return [...rows.values()];
}

function windowStats(rows) {
  const loggedDays = rows.filter((r) => r.hasLog).length;
  const avg = (key) => mean(rows.map((r) => r[key]).filter((v) => typeof v === "number"));
  const nightShare = (() => {
    const withBuckets = rows.filter((r) => r.totalBucketed > 0);
    if (withBuckets.length === 0) return null;
    const totalNight = withBuckets.reduce((s, r) => s + r.nightCommits, 0);
    const total = withBuckets.reduce((s, r) => s + r.totalBucketed, 0);
    return total > 0 ? totalNight / total : null;
  })();

  return {
    loggedDays,
    sleepHours: avg("sleepHours"),
    codingHours: avg("codingHours"),
    commits: avg("commits"),
    taskDifficulty: avg("taskDifficulty"),
    coffeeIntake: avg("coffeeIntake"),
    nightShare,
  };
}

function component(key, label, recentValue, priorValue, span, direction, unit) {
  if (recentValue === null || priorValue === null) {
    return { key, label, available: false, recent: null, prior: null, delta: null, risk: 0 };
  }
  const delta = recentValue - priorValue;
  return {
    key,
    label,
    available: true,
    recent: recentValue,
    prior: priorValue,
    delta,
    unit,
    risk: normalize(delta, span, direction),
  };
}

function emptyResult(sampleSize, reason) {
  return { score: null, level: null, sampleSize, windowDays: WINDOW_DAYS, components: [], reason };
}

// The actual calculation, factored out of the query below so
// convex/burnoutHistory.js's daily snapshot can compute the same score for
// every user from a mutation context (no signed-in caller to derive userId
// from there) without duplicating any of this logic.
export async function computeBurnoutRisk(ctx, userId) {
  const today = new Date().toISOString().slice(0, 10);
  const recentStart = shiftDateString(today, -(WINDOW_DAYS - 1));
  const priorEnd = shiftDateString(recentStart, -1);
  const priorStart = shiftDateString(priorEnd, -(WINDOW_DAYS - 1));

  const [recentRows, priorRows] = await Promise.all([
    buildWindowRows(ctx, userId, recentStart, today),
    buildWindowRows(ctx, userId, priorStart, priorEnd),
  ]);

  const recent = windowStats(recentRows);
  const prior = windowStats(priorRows);

  if (recent.loggedDays < MIN_DAYS_FOR_BURNOUT) {
    return { ...emptyResult(recent.loggedDays, "insufficient-data"), minDays: MIN_DAYS_FOR_BURNOUT };
  }

  const components = [
    component(
      "sleep",
      "Sleep",
      recent.sleepHours,
      prior.sleepHours,
      SLEEP_DROP_FOR_MAX_RISK,
      -1,
      "h/day",
    ),
    component(
      "hoursUp",
      "Coding hours",
      recent.codingHours,
      prior.codingHours,
      HOURS_UP_FOR_MAX_RISK,
      1,
      "h/day",
    ),
    component(
      "outputDown",
      "Commit output",
      recent.commits,
      prior.commits,
      COMMITS_DOWN_FOR_MAX_RISK,
      -1,
      "commits/day",
    ),
    component(
      "nightShare",
      "Late-night coding share",
      recent.nightShare,
      prior.nightShare,
      NIGHT_SHARE_UP_FOR_MAX_RISK,
      1,
      "fraction",
    ),
    component(
      "difficulty",
      "Task difficulty",
      recent.taskDifficulty,
      prior.taskDifficulty,
      DIFFICULTY_UP_FOR_MAX_RISK,
      1,
      "1-5",
    ),
    component(
      "coffee",
      "Coffee intake",
      recent.coffeeIntake,
      prior.coffeeIntake,
      COFFEE_UP_FOR_MAX_RISK,
      1,
      "cups/day",
    ),
  ];

  const available = components.filter((c) => c.available);
  const score =
    available.length === 0 ? null : Math.round((mean(available.map((c) => c.risk)) ?? 0) * 100);

  const level = score === null ? null : score < 33 ? "low" : score < 66 ? "moderate" : "high";

  return {
    score,
    level,
    sampleSize: recent.loggedDays,
    windowDays: WINDOW_DAYS,
    components,
    reason: null,
  };
}

export const getBurnoutRisk = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return emptyResult(0, "not-signed-in");
    return computeBurnoutRisk(ctx, userId);
  },
});

// A plain-language narration of the rule-based score above, not a second
// opinion — the score/level computed by getBurnoutRisk stays the source of
// truth (it's auditable; an LLM call is not), and Claude is only asked to
// explain it and suggest what to do next in language a non-technical reader
// can follow, the same trust model as convex/weeklySummary.js.
function buildAssessmentPrompt(rule) {
  const signals = rule.components
    .filter((c) => c.available)
    .map(
      (c) =>
        `- ${c.label}: ${c.recent?.toFixed?.(2) ?? c.recent} now vs ${c.prior?.toFixed?.(2) ?? c.prior} before (${c.delta > 0 ? "+" : ""}${c.delta?.toFixed?.(2) ?? c.delta} ${c.unit})`,
    )
    .join("\n");

  return `You are explaining a rule-based burnout risk score to the developer it's about, in plain language a non-technical reader can follow — no jargon like "z-score", "standard deviation", or "regression".

The score (0-100, already computed, do not recalculate or contradict it) is ${rule.score}, rated "${rule.level}". It compares this developer's last ${rule.windowDays} days to the ${rule.windowDays} days before that, based on ${rule.sampleSize} logged day(s).

Signals that moved (recent vs. prior window):
${signals || "(none available)"}

Write a JSON object with exactly these keys:
- "headline": one plain sentence (no numbers) capturing the overall picture.
- "reasoning": 1-2 sentences pointing to which specific signal(s) above are driving the picture, in everyday language.
- "suggestions": an array of 1-3 short, practical, non-clinical suggestions (e.g. workload/schedule adjustments). Do not give medical advice or diagnose a condition — this is a heuristic from coding activity, not a health assessment.

If the risk level is "low", keep the tone reassuring and brief rather than manufacturing concern. Respond with ONLY the JSON object, no markdown fences, no other text.`;
}

function buildMockAssessment(rule) {
  const base = {
    headline:
      rule.level === "low"
        ? "Things look steady — no signs of strain in your recent activity."
        : rule.level === "moderate"
          ? "A few signals are drifting in a burnout-shaped direction."
          : "Several signals together point toward burnout risk right now.",
    reasoning: "[Mock assessment — set ANTHROPIC_API_KEY on this deployment for a real one.]",
    suggestions: [],
  };
  return { ...rule, ...base };
}

function parseAssessmentJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const parsed = JSON.parse(cleaned);
  if (typeof parsed.headline !== "string" || typeof parsed.reasoning !== "string") {
    throw new Error("Missing required fields");
  }
  return {
    headline: parsed.headline,
    reasoning: parsed.reasoning,
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
  };
}

export const getBurnoutAssessment = action({
  args: {},
  handler: async (ctx) => {
    const rule = await ctx.runQuery(api.burnout.getBurnoutRisk, {});
    if (rule.score === null) {
      return { ...rule, headline: null, reasoning: null, suggestions: [] };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return buildMockAssessment(rule);
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ASSESSMENT_MODEL,
        max_tokens: 512,
        output_config: { effort: "low" },
        messages: [{ role: "user", content: buildAssessmentPrompt(rule) }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ConvexError(`Claude API error (${response.status}): ${text.slice(0, 300)}`);
    }

    const data = await response.json();
    if (data.stop_reason === "refusal") {
      throw new ConvexError("Claude declined to assess this data.");
    }

    const textBlock = data.content.find((block) => block.type === "text");
    if (!textBlock) {
      throw new ConvexError("Claude returned no text content.");
    }

    try {
      return { ...rule, ...parseAssessmentJson(textBlock.text) };
    } catch {
      throw new ConvexError("Claude's response could not be parsed as an assessment.");
    }
  },
});
