import { action, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Ingestion of the WakaTime layer — measured, like githubDaily, because it
// comes from an external API rather than being typed in. Pulled on demand
// via the user's own API key rather than pushed, so no new HTTP route is
// needed (see convex/http.ts).

const WAKATIME_SUMMARIES_URL = "https://wakatime.com/api/v1/users/current/summaries";
const WAKATIME_DURATIONS_URL = "https://wakatime.com/api/v1/users/current/durations";

// WakaTime's summaries endpoint is cheap per day but this still bounds a
// single sync so one click can't fan out into months of requests-in-one-call.
const MAX_WAKATIME_SYNC_DAYS = 30;

// Durations blocks separated by less than this are treated as one unbroken
// sitting — WakaTime still emits a new block across an editor idle timeout,
// project switch, etc. even when the developer never actually got up.
const SESSION_GAP_SECONDS = 15 * 60;

function authHeaders(apiKey) {
  return {
    // WakaTime's Basic auth is base64(api_key + ":") — a bare key without the
    // trailing colon is rejected.
    Authorization: `Basic ${btoa(`${apiKey}:`)}`,
    Accept: "application/json",
    "User-Agent": "DevHabit (github.com/Ye-Thihaa/DevHabit)",
  };
}

// Merges duration blocks into sittings and returns the longest one, in
// minutes. Blocks are wall-clock spans (time + duration, seconds since
// epoch), so this measures "how long were they sitting there coding", not
// the sum of active seconds within that span.
export function longestSessionMinutes(blocks) {
  if (!blocks || blocks.length === 0) return null;
  const sorted = [...blocks].sort((a, b) => a.time - b.time);

  let longestSpan = 0;
  let sessionStart = sorted[0].time;
  let sessionEnd = sorted[0].time + sorted[0].duration;

  for (let i = 1; i < sorted.length; i++) {
    const block = sorted[i];
    const blockEnd = block.time + block.duration;
    if (block.time - sessionEnd <= SESSION_GAP_SECONDS) {
      sessionEnd = Math.max(sessionEnd, blockEnd);
    } else {
      longestSpan = Math.max(longestSpan, sessionEnd - sessionStart);
      sessionStart = block.time;
      sessionEnd = blockEnd;
    }
  }
  longestSpan = Math.max(longestSpan, sessionEnd - sessionStart);
  return Math.round(longestSpan / 60);
}

// Best-effort: one day's session length is a nice-to-have, not worth failing
// an otherwise-successful sync over. A bad response for one date just leaves
// that date's longestSessionMinutes null.
async function fetchDurationBlocks(apiKey, date) {
  try {
    const response = await fetch(`${WAKATIME_DURATIONS_URL}?date=${date}`, {
      headers: authHeaders(apiKey),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return null;
    const payload = await response.json();
    return Array.isArray(payload.data) ? payload.data : null;
  } catch {
    return null;
  }
}

async function resolveUser(ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Not signed in");

  const user = await ctx.runQuery(api.users.getCurrentUser);
  if (!user) throw new ConvexError("User not found");
  if (!user.wakatimeApiKey) {
    throw new ConvexError("Add a WakaTime API key before syncing");
  }
  return { userId, apiKey: user.wakatimeApiKey };
}

export const syncRecent = action({
  args: {
    // How far back to pull, ending today.
    days: v.optional(v.number()),
  },
  handler: async (ctx, { days = 30 }) => {
    const { userId, apiKey } = await resolveUser(ctx);

    const span = Math.min(Math.max(Math.floor(days), 1), MAX_WAKATIME_SYNC_DAYS);
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - (span - 1) * 86_400_000).toISOString().slice(0, 10);

    const url = `${WAKATIME_SUMMARIES_URL}?start=${startDate}&end=${endDate}`;
    let payload;
    try {
      const response = await fetch(url, { headers: authHeaders(apiKey) });
      if (!response.ok) {
        const text = await response.text();
        throw new ConvexError(`WakaTime API error (${response.status}): ${text.slice(0, 300)}`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        const text = await response.text();
        throw new ConvexError(
          `WakaTime returned a non-JSON response (content-type: ${contentType || "unknown"}): ${text.slice(0, 300)}`,
        );
      }
      payload = await response.json();
    } catch (err) {
      const message =
        err instanceof ConvexError
          ? String(err.data)
          : `${err instanceof Error ? err.name : "Error"}: ${err instanceof Error ? err.message : String(err)}`;
      await ctx.runMutation(internal.wakatime.recordSyncRun, {
        userId,
        kind: "wakatime",
        startDate,
        endDate,
        daysWritten: 0,
        status: "error",
        message,
      });
      throw err instanceof ConvexError ? err : new ConvexError(message);
    }

    const rows = (payload.data ?? []).map((day) => ({
      date: day.range?.date ?? day.range?.start?.slice(0, 10),
      codingSeconds: Math.round(day.grand_total?.total_seconds ?? 0),
      languages: (day.languages ?? [])
        .filter((l) => l.total_seconds > 0)
        .map((l) => ({ name: l.name, seconds: Math.round(l.total_seconds) })),
    })).filter((row) => row.date);

    // One extra request per day to find the longest unbroken sitting that
    // day — the summaries endpoint only gives the daily total, not how it was
    // distributed across the day.
    const durationsByRow = await Promise.all(
      rows.map((row) => fetchDurationBlocks(apiKey, row.date)),
    );
    rows.forEach((row, i) => {
      row.longestSessionMinutes = longestSessionMinutes(durationsByRow[i]) ?? undefined;
    });

    const written = await ctx.runMutation(internal.wakatime.writeWakatimeDays, { userId, rows });

    await ctx.runMutation(internal.wakatime.recordSyncRun, {
      userId,
      kind: "wakatime",
      startDate,
      endDate,
      daysWritten: written,
      status: "ok",
    });

    return {
      startDate,
      endDate,
      daysWritten: written,
      totalCodingHours: rows.reduce((sum, r) => sum + r.codingSeconds, 0) / 3600,
    };
  },
});

export const writeWakatimeDays = internalMutation({
  args: {
    userId: v.id("users"),
    rows: v.array(
      v.object({
        date: v.string(),
        codingSeconds: v.number(),
        languages: v.array(v.object({ name: v.string(), seconds: v.number() })),
        longestSessionMinutes: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { userId, rows }) => {
    let written = 0;
    for (const row of rows) {
      const existing = await ctx.db
        .query("wakatimeDaily")
        .withIndex("by_user_and_date", (q) => q.eq("userId", userId).eq("date", row.date))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { ...row, fetchedAt: Date.now() });
      } else {
        await ctx.db.insert("wakatimeDaily", { userId, ...row, fetchedAt: Date.now() });
      }
      written++;
    }
    return written;
  },
});

export const recordSyncRun = internalMutation({
  args: {
    userId: v.id("users"),
    kind: v.literal("wakatime"),
    startDate: v.string(),
    endDate: v.string(),
    daysWritten: v.number(),
    status: v.union(v.literal("ok"), v.literal("error")),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("syncRuns", { ...args, ranAt: Date.now() });
  },
});
