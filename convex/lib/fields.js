// Single source of truth for the analysable fields.
//
// `source` is the important column: "self" fields are typed in by the user and
// carry recall and desirability bias, "github" fields come from the API and are
// measured. Any statement the app makes about a relationship between two fields
// should be readable alongside where each side came from.
//
// `plausibleMax` is a data-quality bound, not a validation bound. Values above
// it are still stored — they are flagged as outliers by analytics.getDataQuality
// rather than rejected, because a genuine 16-hour day should not be silently
// discarded.

export const FIELD_DEFS = [
  // --- self-reported -----------------------------------------------------
  {
    key: "codingHours",
    label: "Coding Hours",
    source: "self",
    unit: "h",
    min: 0,
    max: 24,
    plausibleMax: 16,
  },
  {
    key: "sleepHours",
    label: "Sleep Hours",
    source: "self",
    unit: "h",
    min: 0,
    max: 24,
    plausibleMax: 14,
  },
  {
    key: "coffeeIntake",
    label: "Coffee Intake",
    source: "self",
    unit: "cups",
    min: 0,
    max: 30,
    plausibleMax: 10,
  },
  {
    key: "aiToolUsageMinutes",
    label: "AI Tool Usage",
    source: "self",
    unit: "min",
    min: 0,
    max: 1440,
    plausibleMax: 600,
  },
  {
    key: "problemsSolved",
    label: "Problems Solved",
    source: "self",
    min: 0,
    max: 200,
    plausibleMax: 30,
  },
  {
    key: "taskDifficulty",
    label: "Task Difficulty",
    source: "self",
    min: 1,
    max: 5,
    plausibleMax: 5,
    scale: true,
  },
  {
    key: "experienceLevel",
    label: "Experience Level",
    source: "self",
    min: 1,
    max: 5,
    plausibleMax: 5,
    scale: true,
  },
  {
    key: "programmingScore",
    label: "Programming Score",
    source: "self",
    min: 1,
    max: 10,
    plausibleMax: 10,
    scale: true,
  },

  // --- measured from GitHub ----------------------------------------------
  { key: "commits", label: "Commits", source: "github", min: 0, plausibleMax: 60 },
  { key: "pullRequestsOpened", label: "PRs Opened", source: "github", min: 0, plausibleMax: 15 },
  { key: "issuesOpened", label: "Issues Opened", source: "github", min: 0, plausibleMax: 20 },
  { key: "reviews", label: "PR Reviews", source: "github", min: 0, plausibleMax: 25 },
  { key: "additions", label: "Lines Added", source: "github", min: 0, plausibleMax: 5000 },
  { key: "deletions", label: "Lines Deleted", source: "github", min: 0, plausibleMax: 5000 },
  { key: "reposTouched", label: "Repos Touched", source: "github", min: 0, plausibleMax: 8 },
  { key: "nightCommits", label: "Night Commits", source: "github", min: 0, plausibleMax: 30 },

  // --- measured from WakaTime ---------------------------------------------
  {
    key: "longestSessionMinutes",
    label: "Longest Session",
    source: "wakatime",
    unit: "min",
    min: 0,
    plausibleMax: 300,
  },
];

export const SELF_FIELDS = FIELD_DEFS.filter((f) => f.source === "self").map((f) => f.key);
export const GITHUB_FIELDS = FIELD_DEFS.filter((f) => f.source === "github").map((f) => f.key);
export const ALL_FIELDS = FIELD_DEFS.map((f) => f.key);

export const FIELD_BY_KEY = Object.fromEntries(FIELD_DEFS.map((f) => [f.key, f]));

export function isKnownField(key) {
  return Object.prototype.hasOwnProperty.call(FIELD_BY_KEY, key);
}
