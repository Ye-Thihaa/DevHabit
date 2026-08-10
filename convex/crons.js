import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Keeps WakaTime data (and the "Today" ring it feeds) fresh without the user
// needing to remember to click Sync — see convex/wakatime.js for why this
// only pulls a 2-day lookback rather than the user-triggered 30-day sync.
crons.interval(
  "sync wakatime for connected users",
  { minutes: 20 },
  internal.wakatime.syncAllConnectedUsers,
);

export default crons;
