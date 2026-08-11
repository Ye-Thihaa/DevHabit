import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { longestSessionMinutes } from "./wakatime.js";

async function signInAs(t, userId) {
  return t.withIdentity({ subject: userId });
}

async function makeUser(t, fields = {}) {
  return await t.run(async (ctx) => ctx.db.insert("users", fields));
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("syncRecent", () => {
  test("throws when the user has no WakaTime API key on file, without calling fetch", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(asUser.action(api.wakatime.syncRecent, {})).rejects.toThrow(
      "Add a WakaTime API key before syncing",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("sends Basic auth as base64(key + ':'), not base64(key) alone", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { wakatimeApiKey: "waka_test_key" });
    const asUser = await signInAs(t, userId);

    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    vi.stubGlobal("fetch", fetchSpy);

    await asUser.action(api.wakatime.syncRecent, { days: 1 });

    const [, requestInit] = fetchSpy.mock.calls[0];
    const expected = `Basic ${btoa("waka_test_key:")}`;
    expect(requestInit.headers.Authorization).toBe(expected);
    // Guards against regressing to the bug this fixed: a bare base64(key)
    // with no trailing colon is a different string and was silently rejected.
    expect(requestInit.headers.Authorization).not.toBe(`Basic ${btoa("waka_test_key")}`);
  });

  test("writes a wakatimeDaily row per day and records a successful sync run", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { wakatimeApiKey: "waka_test_key" });
    const asUser = await signInAs(t, userId);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: [
            {
              range: { date: "2026-08-09" },
              grand_total: { total_seconds: 3600 },
              languages: [{ name: "TypeScript", total_seconds: 3600 }],
            },
            {
              range: { date: "2026-08-10" },
              grand_total: { total_seconds: 1800 },
              languages: [],
            },
          ],
        }),
      ),
    );

    const result = await asUser.action(api.wakatime.syncRecent, { days: 2 });
    expect(result.daysWritten).toBe(2);
    expect(result.totalCodingHours).toBeCloseTo(1.5, 5);

    const rows = await t.run(async (ctx) => ctx.db.query("wakatimeDaily").collect());
    expect(rows).toHaveLength(2);
    const day1 = rows.find((r) => r.date === "2026-08-09");
    expect(day1.codingSeconds).toBe(3600);
    expect(day1.languages).toEqual([{ name: "TypeScript", seconds: 3600 }]);

    const syncRuns = await t.run(async (ctx) => ctx.db.query("syncRuns").collect());
    expect(syncRuns).toHaveLength(1);
    expect(syncRuns[0].status).toBe("ok");
    expect(syncRuns[0].daysWritten).toBe(2);
  });

  test("fills in longestSessionMinutes from the durations endpoint, per day", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { wakatimeApiKey: "waka_test_key" });
    const asUser = await signInAs(t, userId);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url) => {
        if (url.includes("/summaries")) {
          return jsonResponse({
            data: [
              { range: { date: "2026-08-09" }, grand_total: { total_seconds: 7200 }, languages: [] },
              { range: { date: "2026-08-10" }, grand_total: { total_seconds: 1800 }, languages: [] },
            ],
          });
        }
        // /durations?date=...
        if (url.includes("date=2026-08-09")) {
          return jsonResponse({ data: [{ time: 0, duration: 2 * 60 * 60 }] });
        }
        // 2026-08-10's durations call fails — should not break the sync.
        return { ok: false, status: 500, headers: { get: () => "text/plain" }, text: async () => "oops" };
      }),
    );

    const result = await asUser.action(api.wakatime.syncRecent, { days: 2 });
    expect(result.daysWritten).toBe(2);

    const rows = await t.run(async (ctx) => ctx.db.query("wakatimeDaily").collect());
    const day1 = rows.find((r) => r.date === "2026-08-09");
    const day2 = rows.find((r) => r.date === "2026-08-10");
    expect(day1.longestSessionMinutes).toBe(120);
    expect(day2.longestSessionMinutes).toBeUndefined();
  });

  test("re-syncing the same day updates the existing row instead of duplicating it", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { wakatimeApiKey: "waka_test_key" });
    const asUser = await signInAs(t, userId);

    const dayPayload = (seconds) =>
      jsonResponse({
        data: [{ range: { date: "2026-08-10" }, grand_total: { total_seconds: seconds }, languages: [] }],
      });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(dayPayload(1000)));
    await asUser.action(api.wakatime.syncRecent, { days: 1 });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(dayPayload(2000)));
    await asUser.action(api.wakatime.syncRecent, { days: 1 });

    const rows = await t.run(async (ctx) => ctx.db.query("wakatimeDaily").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].codingSeconds).toBe(2000);
  });

  test("a non-ok response is recorded as an error sync run and rejects with the status", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { wakatimeApiKey: "waka_test_key" });
    const asUser = await signInAs(t, userId);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Object.assign(jsonResponse({}, { ok: false, status: 401 }), {
          text: async () => "Unauthorized",
        }),
      ),
    );

    await expect(asUser.action(api.wakatime.syncRecent, { days: 1 })).rejects.toThrow(
      /WakaTime API error \(401\)/,
    );

    const syncRuns = await t.run(async (ctx) => ctx.db.query("syncRuns").collect());
    expect(syncRuns).toHaveLength(1);
    expect(syncRuns[0].status).toBe("error");
    expect(syncRuns[0].message).toMatch(/401/);
  });

  test("a non-JSON 200 response (e.g. a bot-check page) fails with a clear message instead of a raw parse error", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { wakatimeApiKey: "waka_test_key" });
    const asUser = await signInAs(t, userId);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "text/html" },
        text: async () => "<html>are you a robot?</html>",
        json: async () => {
          throw new Error("Unexpected token < in JSON");
        },
      }),
    );

    await expect(asUser.action(api.wakatime.syncRecent, { days: 1 })).rejects.toThrow(
      /non-JSON response/,
    );

    const syncRuns = await t.run(async (ctx) => ctx.db.query("syncRuns").collect());
    expect(syncRuns[0].status).toBe("error");
    expect(syncRuns[0].message).toMatch(/non-JSON response/);
  });

  test("days is clamped to the 30-day cap even if a larger value is requested", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { wakatimeApiKey: "waka_test_key" });
    const asUser = await signInAs(t, userId);

    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await asUser.action(api.wakatime.syncRecent, { days: 9999 });
    const spanDays =
      (new Date(result.endDate).getTime() - new Date(result.startDate).getTime()) / 86_400_000 + 1;
    expect(spanDays).toBe(30);
  });
});

describe("longestSessionMinutes", () => {
  test("returns null for no blocks", () => {
    expect(longestSessionMinutes([])).toBeNull();
    expect(longestSessionMinutes(null)).toBeNull();
  });

  test("a single block is its own session", () => {
    const blocks = [{ time: 1000, duration: 1800 }]; // 30 minutes
    expect(longestSessionMinutes(blocks)).toBe(30);
  });

  test("merges blocks separated by a small gap into one sitting", () => {
    const blocks = [
      { time: 0, duration: 3600 }, // 0:00–1:00
      { time: 3600 + 5 * 60, duration: 3600 }, // 1:05–2:05, 5 min gap
    ];
    // Merged span is 0:00 to 2:05 = 125 minutes, not 60+60=120.
    expect(longestSessionMinutes(blocks)).toBe(125);
  });

  test("does not merge across a gap over 15 minutes, and reports the longer side", () => {
    const blocks = [
      { time: 0, duration: 60 * 60 }, // 60-minute session
      { time: 60 * 60 + 20 * 60, duration: 3 * 60 * 60 }, // 20 min later, a 3-hour session
    ];
    expect(longestSessionMinutes(blocks)).toBe(180);
  });

  test("is order-independent", () => {
    const inOrder = [
      { time: 0, duration: 600 },
      { time: 700, duration: 600 },
    ];
    const reversed = [inOrder[1], inOrder[0]];
    expect(longestSessionMinutes(reversed)).toBe(longestSessionMinutes(inOrder));
  });
});

describe("writeWakatimeDays (internal mutation)", () => {
  test("upserts by (userId, date) instead of inserting duplicates", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);

    await t.mutation(internal.wakatime.writeWakatimeDays, {
      userId,
      rows: [{ date: "2026-08-01", codingSeconds: 100, languages: [] }],
    });
    await t.mutation(internal.wakatime.writeWakatimeDays, {
      userId,
      rows: [{ date: "2026-08-01", codingSeconds: 200, languages: [] }],
    });

    const rows = await t.run(async (ctx) => ctx.db.query("wakatimeDaily").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].codingSeconds).toBe(200);
  });
});
