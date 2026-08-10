import { query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ALL_FIELDS, FIELD_BY_KEY, SELF_FIELDS, isKnownField } from "./lib/fields.js";
import {
  dateRange,
  daysBetween,
  describe,
  mean,
  pearson,
  shiftDateString,
  stdDev,
} from "./lib/stats.js";
// Correlations below this many pairs are not reported at all — three points can
// produce r = 0.99 from noise. See lib/thresholds.js for the reasoning.
import { MIN_PAIRS_FOR_CORRELATION } from "./lib/thresholds.js";

// The derived layer. Nothing here is stored — every query joins the
// self-reported table to the measured table on (userId, date) and computes from
// scratch. That costs a little on read and buys the guarantee that a statistic
// can never be stale relative to the rows it claims to summarise.

async function requireUserId(ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return userId;
}

// Joins both source tables into one row per date, with a per-row record of
// which layers actually contributed.
async function buildDataset(ctx, userId, startDate, endDate, { includeSeeded = true } = {}) {
  const logsQuery = ctx.db
    .query("dailyLogs")
    .withIndex("by_user_and_date", (q) =>
      startDate && endDate
        ? q.eq("userId", userId).gte("date", startDate).lte("date", endDate)
        : q.eq("userId", userId),
    );
  const githubQuery = ctx.db
    .query("githubDaily")
    .withIndex("by_user_and_date", (q) =>
      startDate && endDate
        ? q.eq("userId", userId).gte("date", startDate).lte("date", endDate)
        : q.eq("userId", userId),
    );
  const wakatimeQuery = ctx.db
    .query("wakatimeDaily")
    .withIndex("by_user_and_date", (q) =>
      startDate && endDate
        ? q.eq("userId", userId).gte("date", startDate).lte("date", endDate)
        : q.eq("userId", userId),
    );

  const [logs, github, wakatime] = await Promise.all([
    logsQuery.collect(),
    githubQuery.collect(),
    wakatimeQuery.collect(),
  ]);

  const usableLogs = includeSeeded ? logs : logs.filter((l) => l.isSeeded !== true);

  const logByDate = new Map(usableLogs.map((l) => [l.date, l]));
  const ghByDate = new Map(github.map((g) => [g.date, g]));
  const wtByDate = new Map(wakatime.map((w) => [w.date, w]));

  const dates = [...new Set([...logByDate.keys(), ...ghByDate.keys(), ...wtByDate.keys()])].sort();

  return dates.map((date) => {
    const log = logByDate.get(date);
    const gh = ghByDate.get(date);
    const wt = wtByDate.get(date);
    const row = { date };

    for (const key of SELF_FIELDS) {
      row[key] = log ? log[key] : null;
    }
    row.commits = gh ? gh.commits : null;
    row.pullRequestsOpened = gh ? gh.pullRequestsOpened : null;
    row.issuesOpened = gh ? gh.issuesOpened : null;
    row.reviews = gh ? gh.reviews : null;
    // additions/deletions are the cleaned figures — generated files removed.
    // The raw pair rides along for the data-quality view only; it is not an
    // analysable field, because it mostly measures lockfile churn.
    row.additions = gh?.additions ?? null;
    row.deletions = gh?.deletions ?? null;
    row.additionsRaw = gh?.additionsRaw ?? null;
    row.deletionsRaw = gh?.deletionsRaw ?? null;
    row.filesChanged = gh?.filesChanged ?? null;
    row.filesExcluded = gh?.filesExcluded ?? null;
    row.reposTouched = gh?.reposTouched ?? null;
    row.nightCommits = gh?.commitsByBucket?.night ?? null;
    row.commitsByBucket = gh?.commitsByBucket ?? null;
    row.longestSessionMinutes = wt?.longestSessionMinutes ?? null;

    // WakaTime's measured hours supersede the self-reported figure — it's
    // the more objective source for the same quantity, and the daily-log
    // form stops collecting it at all once a user connects WakaTime. But
    // WakaTime's summaries endpoint returns codingSeconds: 0 for every day
    // in the requested range, including days before the plugin was even
    // installed — it cannot distinguish "genuinely didn't code" from "wasn't
    // tracked yet". So a zero is treated as "no measurement" and falls back
    // to self-reported, rather than confidently zeroing out real history.
    row.codingHoursSource = wt && wt.codingSeconds > 0 ? "wakatime" : log ? "self" : null;
    if (row.codingHoursSource === "wakatime") {
      row.codingHours = wt.codingSeconds / 3600;
    }

    row.hasSelfReported = Boolean(log);
    row.hasGithub = Boolean(gh);
    row.hasWakatime = Boolean(wt);
    row.isSeeded = log?.isSeeded === true;
    row.githubDetailLevel = gh?.detailLevel ?? null;

    return row;
  });
}

function columnOf(rows, key) {
  return rows.map((r) => (typeof r[key] === "number" ? r[key] : NaN));
}

// --- today ----------------------------------------------------------------

// Powers the "Today" ring on the dashboard. Deliberately excludes seed data —
// this widget's whole point is to show a brand-new user their real current
// state, and seed rows would paper over exactly the "I have no history yet"
// moment it exists to handle.
//
// The reference/target hours is the user's own trailing 30-day average once
// there's enough of one to be meaningful (5+ days); before that, a flat 4h
// is used as a neutral, non-personalized reference so the ring still means
// something on day one rather than being empty or arbitrary.
const REFERENCE_WINDOW_DAYS = 30;
const MIN_DAYS_FOR_PERSONAL_REFERENCE = 5;
const DEFAULT_REFERENCE_HOURS = 4;

export const getTodaySnapshot = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    if (!userId) return null;

    const today = new Date().toISOString().slice(0, 10);
    const referenceStart = shiftDateString(today, -REFERENCE_WINDOW_DAYS);
    const referenceEnd = shiftDateString(today, -1);

    const [todayRows, referenceRows] = await Promise.all([
      buildDataset(ctx, userId, today, today, { includeSeeded: false }),
      buildDataset(ctx, userId, referenceStart, referenceEnd, { includeSeeded: false }),
    ]);

    const todayRow = todayRows[0] ?? null;
    const codingHours = typeof todayRow?.codingHours === "number" ? todayRow.codingHours : null;
    const source = todayRow?.codingHoursSource ?? null;

    const referenceValues = referenceRows
      .map((r) => r.codingHours)
      .filter((v) => typeof v === "number");
    const personalAverage =
      referenceValues.length >= MIN_DAYS_FOR_PERSONAL_REFERENCE ? mean(referenceValues) : null;

    return {
      date: today,
      codingHours,
      source,
      referenceHours: personalAverage ?? DEFAULT_REFERENCE_HOURS,
      referenceIsPersonal: personalAverage !== null,
    };
  },
});

// --- dataset -------------------------------------------------------------

export const getDataset = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    includeSeeded: v.optional(v.boolean()),
  },
  handler: async (ctx, { startDate, endDate, includeSeeded = true }) => {
    const userId = await requireUserId(ctx);
    if (!userId) return [];
    return await buildDataset(ctx, userId, startDate, endDate, { includeSeeded });
  },
});

// --- descriptive ---------------------------------------------------------

export const getDescriptiveStats = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    includeSeeded: v.optional(v.boolean()),
  },
  handler: async (ctx, { startDate, endDate, includeSeeded = true }) => {
    const userId = await requireUserId(ctx);
    if (!userId) return { rows: [], totalDays: 0 };

    const data = await buildDataset(ctx, userId, startDate, endDate, { includeSeeded });

    const rows = ALL_FIELDS.map((key) => {
      const def = FIELD_BY_KEY[key];
      const stats = describe(columnOf(data, key));
      return {
        key,
        label: def.label,
        source: def.source,
        unit: def.unit ?? null,
        ...stats,
        // Share of the range where this field has no value at all.
        missingDays: data.length - stats.n,
      };
    });

    return { rows, totalDays: data.length };
  },
});

// --- correlation ---------------------------------------------------------

export const getCorrelationMatrix = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    includeSeeded: v.optional(v.boolean()),
  },
  handler: async (ctx, { startDate, endDate, includeSeeded = true }) => {
    const userId = await requireUserId(ctx);
    if (!userId)
      return { matrix: {}, fields: [], totalDays: 0, minPairs: MIN_PAIRS_FOR_CORRELATION };

    const data = await buildDataset(ctx, userId, startDate, endDate, { includeSeeded });
    const columns = Object.fromEntries(ALL_FIELDS.map((key) => [key, columnOf(data, key)]));

    const matrix = {};
    for (const a of ALL_FIELDS) {
      matrix[a] = {};
      for (const b of ALL_FIELDS) {
        const { r, n, p } = pearson(columns[a], columns[b]);
        // Suppress the estimate below the pair threshold but still report n, so
        // the UI can explain the blank rather than showing a misleading number.
        const underpowered = n < MIN_PAIRS_FOR_CORRELATION;
        matrix[a][b] = {
          r: underpowered ? null : r,
          n,
          p: underpowered ? null : p,
          significant: !underpowered && p !== null && p < 0.05,
          underpowered,
        };
      }
    }

    return {
      matrix,
      fields: ALL_FIELDS.map((key) => ({
        key,
        label: FIELD_BY_KEY[key].label,
        source: FIELD_BY_KEY[key].source,
      })),
      totalDays: data.length,
      minPairs: MIN_PAIRS_FOR_CORRELATION,
    };
  },
});

// Same-day correlation misses most of what this app is trying to see: sleep
// affects the *following* day's work, not the night it happened. This shifts
// the predictor back by 1–3 days against the outcome and reports which lag, if
// any, actually carries signal.
export const getLaggedCorrelations = query({
  args: {
    predictorField: v.string(),
    outcomeField: v.string(),
    maxLag: v.optional(v.number()),
    includeSeeded: v.optional(v.boolean()),
  },
  handler: async (ctx, { predictorField, outcomeField, maxLag = 3, includeSeeded = true }) => {
    if (!isKnownField(predictorField) || !isKnownField(outcomeField)) {
      throw new ConvexError("Unknown field name");
    }

    const userId = await requireUserId(ctx);
    if (!userId) return { lags: [], predictorField, outcomeField };

    const data = await buildDataset(ctx, userId, undefined, undefined, { includeSeeded });
    const byDate = new Map(data.map((row) => [row.date, row]));

    const lags = [];
    const limit = Math.min(Math.max(Math.floor(maxLag), 0), 7);

    for (let lag = 0; lag <= limit; lag++) {
      const xs = [];
      const ys = [];
      for (const row of data) {
        const outcomeRow = byDate.get(shiftDateString(row.date, lag));
        if (!outcomeRow) continue;
        const x = row[predictorField];
        const y = outcomeRow[outcomeField];
        if (typeof x !== "number" || typeof y !== "number") continue;
        xs.push(x);
        ys.push(y);
      }

      const { r, n, p } = pearson(xs, ys);
      const underpowered = n < MIN_PAIRS_FOR_CORRELATION;
      lags.push({
        lag,
        r: underpowered ? null : r,
        n,
        p: underpowered ? null : p,
        significant: !underpowered && p !== null && p < 0.05,
        underpowered,
      });
    }

    return {
      lags,
      predictorField,
      outcomeField,
      predictorLabel: FIELD_BY_KEY[predictorField].label,
      outcomeLabel: FIELD_BY_KEY[outcomeField].label,
      // Testing several lags multiplies the chance of one crossing p < 0.05 by
      // luck; the UI shows this so a "significant" lag-2 result is read with
      // the right amount of scepticism.
      testsRun: limit + 1,
      bonferroniAlpha: 0.05 / (limit + 1),
    };
  },
});

// --- rolling / trend -----------------------------------------------------

export const getRollingAverages = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    windowDays: v.optional(v.number()),
    includeSeeded: v.optional(v.boolean()),
  },
  handler: async (ctx, { startDate, endDate, windowDays = 7, includeSeeded = true }) => {
    const userId = await requireUserId(ctx);
    if (!userId) return [];

    const window = Math.min(Math.max(Math.floor(windowDays), 2), 30);
    // Pull extra days before the range so the first day's window is complete.
    const bufferStart = shiftDateString(startDate, -(window - 1));
    const data = await buildDataset(ctx, userId, bufferStart, endDate, { includeSeeded });
    const byDate = new Map(data.map((row) => [row.date, row]));

    return dateRange(startDate, endDate).map((date) => {
      const windowStart = shiftDateString(date, -(window - 1));
      const windowRows = data.filter((r) => r.date >= windowStart && r.date <= date);

      const averages = {};
      for (const key of ALL_FIELDS) {
        const values = windowRows.map((r) => r[key]).filter((v) => typeof v === "number");
        averages[key] = values.length > 0 ? mean(values) : null;
      }

      return {
        date,
        sampleSize: windowRows.length,
        averages,
        raw: byDate.get(date) ?? null,
      };
    });
  },
});

// Points far from the recent norm, as a rolling z-score. Useful on its own and
// as the input to the "unusual day" callouts.
export const getAnomalies = query({
  args: {
    field: v.string(),
    threshold: v.optional(v.number()),
    includeSeeded: v.optional(v.boolean()),
  },
  handler: async (ctx, { field, threshold = 2, includeSeeded = true }) => {
    if (!isKnownField(field)) throw new ConvexError("Unknown field name");

    const userId = await requireUserId(ctx);
    if (!userId) return [];

    const data = await buildDataset(ctx, userId, undefined, undefined, { includeSeeded });
    const values = data.map((r) => r[field]).filter((v) => typeof v === "number");
    if (values.length < MIN_PAIRS_FOR_CORRELATION) return [];

    const m = mean(values);
    const sd = stdDev(values);
    if (sd === null || sd === 0) return [];

    return data
      .filter((r) => typeof r[field] === "number")
      .map((r) => ({ date: r.date, value: r[field], z: (r[field] - m) / sd }))
      .filter((r) => Math.abs(r.z) >= threshold)
      .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  },
});

// --- data quality --------------------------------------------------------

// The management side of the project: how complete is this dataset, where did
// it come from, and what in it should not be trusted.
export const getDataQuality = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, { startDate, endDate }) => {
    const userId = await requireUserId(ctx);
    if (!userId) return null;

    const data = await buildDataset(ctx, userId, startDate, endDate, { includeSeeded: true });

    if (data.length === 0) {
      return {
        totalDays: 0,
        calendarDays: 0,
        coverage: { both: 0, selfOnly: 0, githubOnly: 0, missing: 0 },
        seededDays: 0,
        outliers: [],
        fieldCompleteness: [],
        githubDetail: { calendar: 0, detailed: 0, migrated: 0 },
        longestGap: 0,
        syncRuns: [],
      };
    }

    const firstDate = startDate ?? data[0].date;
    const lastDate = endDate ?? data[data.length - 1].date;
    const allDates = dateRange(firstDate, lastDate);
    const byDate = new Map(data.map((r) => [r.date, r]));

    let both = 0;
    let selfOnly = 0;
    let githubOnly = 0;
    let missing = 0;
    let longestGap = 0;
    let currentGap = 0;

    for (const date of allDates) {
      const row = byDate.get(date);
      // A GitHub row exists for every day in a backfilled range, including zero
      // commit days — a day only counts as covered if something was recorded.
      const hasSelf = row?.hasSelfReported === true;
      const hasGh = row?.hasGithub === true;

      if (hasSelf && hasGh) both++;
      else if (hasSelf) selfOnly++;
      else if (hasGh) githubOnly++;
      else missing++;

      if (!hasSelf) {
        currentGap++;
        longestGap = Math.max(longestGap, currentGap);
      } else {
        currentGap = 0;
      }
    }

    const fieldCompleteness = ALL_FIELDS.map((key) => {
      const def = FIELD_BY_KEY[key];
      const present = data.filter((r) => typeof r[key] === "number").length;
      return {
        key,
        label: def.label,
        source: def.source,
        present,
        completeness: allDates.length === 0 ? 0 : present / allDates.length,
      };
    });

    const outliers = [];
    for (const key of ALL_FIELDS) {
      const def = FIELD_BY_KEY[key];
      if (def.plausibleMax === undefined) continue;
      for (const row of data) {
        const value = row[key];
        if (typeof value !== "number") continue;
        if (value > def.plausibleMax || (def.min !== undefined && value < def.min)) {
          outliers.push({
            date: row.date,
            key,
            label: def.label,
            value,
            reason: value > def.plausibleMax ? "above plausible range" : "below allowed minimum",
            bound: value > def.plausibleMax ? def.plausibleMax : def.min,
          });
        }
      }
    }

    const githubDetail = { calendar: 0, detailed: 0, migrated: 0 };
    for (const row of data) {
      if (row.githubDetailLevel && githubDetail[row.githubDetailLevel] !== undefined) {
        githubDetail[row.githubDetailLevel]++;
      }
    }

    const syncRuns = await ctx.db
      .query("syncRuns")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(8);

    // How much of the raw diff volume was generated rather than written. On a
    // JS project this is routinely over 99%, which is the whole argument for
    // not using raw line counts as an output measure.
    const cleaned = data.reduce(
      (acc, row) => ({
        additions: acc.additions + (row.additions ?? 0),
        additionsRaw: acc.additionsRaw + (row.additionsRaw ?? 0),
        deletions: acc.deletions + (row.deletions ?? 0),
        deletionsRaw: acc.deletionsRaw + (row.deletionsRaw ?? 0),
        filesChanged: acc.filesChanged + (row.filesChanged ?? 0),
        filesExcluded: acc.filesExcluded + (row.filesExcluded ?? 0),
      }),
      {
        additions: 0,
        additionsRaw: 0,
        deletions: 0,
        deletionsRaw: 0,
        filesChanged: 0,
        filesExcluded: 0,
      },
    );

    const user = await ctx.db.get(userId);

    return {
      timezoneOffsetMinutes: user?.timezoneOffsetMinutes ?? null,
      lineFiltering: {
        ...cleaned,
        excludedShare:
          cleaned.additionsRaw + cleaned.deletionsRaw === 0
            ? 0
            : 1 -
              (cleaned.additions + cleaned.deletions) /
                (cleaned.additionsRaw + cleaned.deletionsRaw),
      },
      totalDays: data.length,
      calendarDays: allDates.length,
      firstDate,
      lastDate,
      coverage: { both, selfOnly, githubOnly, missing },
      seededDays: data.filter((r) => r.isSeeded).length,
      outliers: outliers.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 25),
      fieldCompleteness,
      githubDetail,
      longestGap,
      syncRuns: syncRuns.map((run) => ({
        kind: run.kind,
        startDate: run.startDate,
        endDate: run.endDate,
        daysWritten: run.daysWritten,
        status: run.status,
        message: run.message ?? null,
        ranAt: run.ranAt,
      })),
    };
  },
});

// --- headline numbers ----------------------------------------------------

export const getSummaryStats = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days = 7 }) => {
    const userId = await requireUserId(ctx);
    if (!userId) return null;

    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = shiftDateString(endDate, -(Math.max(days, 1) - 1));
    const data = await buildDataset(ctx, userId, startDate, endDate, { includeSeeded: true });

    const sum = (key) =>
      data.reduce((acc, r) => (typeof r[key] === "number" ? acc + r[key] : acc), 0);
    const avg = (key) => {
      const values = data.map((r) => r[key]).filter((v) => typeof v === "number");
      return values.length ? mean(values) : null;
    };

    return {
      windowDays: daysBetween(startDate, endDate) + 1,
      codingHours: sum("codingHours"),
      commits: sum("commits"),
      avgSleep: avg("sleepHours"),
      daysLogged: data.filter((r) => r.hasSelfReported).length,
      daysWithGithub: data.filter((r) => r.hasGithub).length,
      seededDays: data.filter((r) => r.isSeeded).length,
    };
  },
});
