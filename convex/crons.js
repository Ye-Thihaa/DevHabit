import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Keeps WakaTime data (and the "Today" card it feeds) fresh without the user
// needing to remember to click Sync — see convex/wakatime.js for why this
// only pulls a 2-day lookback rather than the user-triggered 30-day sync.
crons.interval(
  "sync wakatime for connected users",
  { minutes: 20 },
  internal.wakatime.syncAllConnectedUsers,
);

// Snapshots today's burnout score for every user with enough logged days.
// Late in the day (UTC) so most users' "today" window is as complete as
// it'll get before the snapshot — burnoutHistory is a record of the score,
// not a live view, so today's row settling a bit late is fine.
crons.daily(
  "snapshot burnout risk",
  { hourUTC: 23, minuteUTC: 50 },
  internal.burnoutHistory.snapshotAllUsers,
);

// LeetCode exposes running totals only, not a per-day history — see the
// header comment in convex/leetcode.js. One snapshot a day is the only cadence
// that makes sense; snapshotting more often would just measure "how many
// times we polled today", not solving activity. Timed after the burnout
// snapshot so the two crons don't contend for the same users' rows.
crons.daily(
  "snapshot leetcode totals",
  { hourUTC: 23, minuteUTC: 55 },
  internal.leetcode.snapshotAllConnectedUsers,
);

export default crons;
