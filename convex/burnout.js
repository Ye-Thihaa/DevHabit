import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mean, shiftDateString } from "./lib/stats.js";
import { MIN_DAYS_FOR_BURNOUT } from "./lib/thresholds.js";

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
    const row = ensure(wt.date);
    // WakaTime's measured hours supersede the self-reported figure when
    // present — it is the more objective source for the same quantity.
    row.codingHours = wt.codingSeconds / 3600;
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

export const getBurnoutRisk = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return emptyResult(0, "not-signed-in");

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
  },
});
