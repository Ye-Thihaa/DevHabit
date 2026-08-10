import { action, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Ingestion of the WakaTime layer — measured, like githubDaily, because it
// comes from an external API rather than being typed in. Pulled on demand
// via the user's own API key rather than pushed, so no new HTTP route is
// needed (see convex/http.ts).

const WAKATIME_SUMMARIES_URL = "https://wakatime.com/api/v1/users/current/summaries";

// WakaTime's summaries endpoint is cheap per day but this still bounds a
// single sync so one click can't fan out into months of requests-in-one-call.
const MAX_WAKATIME_SYNC_DAYS = 30;

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
      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${btoa(apiKey)}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new ConvexError(`WakaTime API error (${response.status}): ${text.slice(0, 300)}`);
      }
      payload = await response.json();
    } catch (err) {
      await ctx.runMutation(internal.wakatime.recordSyncRun, {
        userId,
        kind: "wakatime",
        startDate,
        endDate,
        daysWritten: 0,
        status: "error",
        message: err instanceof ConvexError ? String(err.data) : "Network error reaching WakaTime",
      });
      throw err;
    }

    const rows = (payload.data ?? []).map((day) => ({
      date: day.range?.date ?? day.range?.start?.slice(0, 10),
      codingSeconds: Math.round(day.grand_total?.total_seconds ?? 0),
      languages: (day.languages ?? [])
        .filter((l) => l.total_seconds > 0)
        .map((l) => ({ name: l.name, seconds: Math.round(l.total_seconds) })),
    })).filter((row) => row.date);

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
