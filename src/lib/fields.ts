export type FieldKey =
  | "codingHours"
  | "sleepHours"
  | "coffeeIntake"
  | "githubCommits"
  | "aiToolUsageMinutes"
  | "problemsSolved"
  | "taskDifficulty"
  | "experienceLevel"
  | "programmingScore";

export const FIELDS: { key: FieldKey; label: string; short: string; unit?: string }[] = [
  { key: "codingHours", label: "Coding Hours", short: "Code", unit: "h" },
  { key: "sleepHours", label: "Sleep Hours", short: "Sleep", unit: "h" },
  { key: "coffeeIntake", label: "Coffee Intake", short: "Coffee", unit: "cups" },
  { key: "githubCommits", label: "GitHub Commits", short: "Commits" },
  { key: "aiToolUsageMinutes", label: "AI Tool Usage", short: "AI", unit: "min" },
  { key: "problemsSolved", label: "Problems Solved", short: "Solved" },
  { key: "taskDifficulty", label: "Task Difficulty", short: "Diff" },
  { key: "experienceLevel", label: "Experience Level", short: "Exp" },
  { key: "programmingScore", label: "Programming Score", short: "Score" },
];
