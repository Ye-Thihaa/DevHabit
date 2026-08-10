// Mirrors convex/lib/fields.js. The backend copy is the source of truth for
// validation and analysis; this one adds display-only detail (short labels for
// the correlation matrix, form hints, input steps).

export type FieldSource = "self" | "github" | "wakatime" | "derived";

export type FieldKey =
  // self-reported
  | "codingHours"
  | "sleepHours"
  | "coffeeIntake"
  | "aiToolUsageMinutes"
  | "problemsSolved"
  | "taskDifficulty"
  | "experienceLevel"
  | "programmingScore"
  // measured from GitHub
  | "commits"
  | "pullRequestsOpened"
  | "issuesOpened"
  | "reviews"
  | "additions"
  | "deletions"
  | "reposTouched"
  | "nightCommits"
  // measured from WakaTime
  | "longestSessionMinutes"
  // derived from the other layers
  | "burnoutScore";

export type FieldDef = {
  key: FieldKey;
  label: string;
  short: string;
  source: FieldSource;
  unit?: string;
  min?: number;
  max?: number;
  step?: string;
  hint?: string;
  scale?: boolean;
};

export const FIELDS: FieldDef[] = [
  {
    key: "codingHours",
    label: "Coding Hours",
    short: "Code",
    source: "self",
    unit: "h",
    min: 0,
    max: 24,
    step: "0.5",
    hint: "hours",
  },
  {
    key: "sleepHours",
    label: "Sleep Hours",
    short: "Sleep",
    source: "self",
    unit: "h",
    min: 0,
    max: 24,
    step: "0.5",
    hint: "hours",
  },
  {
    key: "coffeeIntake",
    label: "Coffee Intake",
    short: "Coffee",
    source: "self",
    unit: "cups",
    min: 0,
    max: 30,
    step: "1",
    hint: "cups",
  },
  {
    key: "aiToolUsageMinutes",
    label: "AI Tool Usage",
    short: "AI",
    source: "self",
    unit: "min",
    min: 0,
    max: 1440,
    step: "5",
    hint: "minutes",
  },
  {
    key: "problemsSolved",
    label: "Problems Solved",
    short: "Solved",
    source: "self",
    min: 0,
    max: 200,
    step: "1",
    hint: "count",
  },
  {
    key: "taskDifficulty",
    label: "Task Difficulty",
    short: "Diff",
    source: "self",
    min: 1,
    max: 5,
    scale: true,
    hint: "1 = trivial, 5 = brutal",
  },
  {
    key: "experienceLevel",
    label: "Experience Level",
    short: "Exp",
    source: "self",
    min: 1,
    max: 5,
    scale: true,
    hint: "1 = new, 5 = expert",
  },
  {
    key: "programmingScore",
    label: "Programming Score",
    short: "Score",
    source: "self",
    min: 1,
    max: 10,
    scale: true,
    hint: "self-rated 1–10",
  },

  { key: "commits", label: "Commits", short: "Commits", source: "github" },
  { key: "pullRequestsOpened", label: "PRs Opened", short: "PRs", source: "github" },
  { key: "issuesOpened", label: "Issues Opened", short: "Issues", source: "github" },
  { key: "reviews", label: "PR Reviews", short: "Reviews", source: "github" },
  { key: "additions", label: "Lines Added", short: "+Lines", source: "github" },
  { key: "deletions", label: "Lines Deleted", short: "−Lines", source: "github" },
  { key: "reposTouched", label: "Repos Touched", short: "Repos", source: "github" },
  { key: "nightCommits", label: "Night Commits", short: "Night", source: "github" },

  {
    key: "longestSessionMinutes",
    label: "Longest Session",
    short: "Session",
    source: "wakatime",
    unit: "min",
    min: 0,
    max: 1440,
    step: "5",
    hint: "minutes",
  },

  { key: "burnoutScore", label: "Burnout Score", short: "Burnout", source: "derived", min: 0, max: 100 },
];

export const SELF_FIELDS = FIELDS.filter((f) => f.source === "self");
export const GITHUB_FIELDS = FIELDS.filter((f) => f.source === "github");

export const FIELD_BY_KEY: Record<string, FieldDef> = Object.fromEntries(
  FIELDS.map((f) => [f.key, f]),
);

export function fieldLabel(key: string): string {
  return FIELD_BY_KEY[key]?.label ?? key;
}

// Used everywhere a number is shown next to its provenance.
export const SOURCE_LABEL: Record<FieldSource, string> = {
  self: "self-reported",
  github: "measured",
  wakatime: "measured",
  derived: "derived",
};
