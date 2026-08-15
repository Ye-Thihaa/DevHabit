// The Convex backend is written in JavaScript, so the generated API types infer
// query return values as `any`. These declarations restate the shapes that
// convex/analytics.js and convex/predictions.js actually return, so the
// dashboard is type-checked against something rather than nothing.
//
// They are hand-maintained: changing a return shape in convex/ means changing
// it here too.

import type { FieldKey, FieldSource } from "@/lib/fields";

export type CorrelationCell = {
  r: number | null;
  n: number;
  p: number | null;
  significant: boolean;
  underpowered: boolean;
};

export type CorrelationMatrix = {
  matrix: Record<string, Record<string, CorrelationCell>>;
  fields: { key: FieldKey; label: string; source: FieldSource }[];
  totalDays: number;
  minPairs: number;
};

export type LagResult = {
  lag: number;
  r: number | null;
  n: number;
  p: number | null;
  significant: boolean;
  underpowered: boolean;
};

export type LaggedCorrelations = {
  lags: LagResult[];
  predictorField: string;
  outcomeField: string;
  predictorLabel: string;
  outcomeLabel: string;
  testsRun: number;
  bonferroniAlpha: number;
};

export type DescriptiveRow = {
  key: FieldKey;
  label: string;
  source: FieldSource;
  unit: string | null;
  n: number;
  mean: number | null;
  sd: number | null;
  min: number | null;
  q1: number | null;
  median: number | null;
  q3: number | null;
  max: number | null;
  missingDays: number;
};

export type DescriptiveStats = {
  rows: DescriptiveRow[];
  totalDays: number;
};

export type DatasetRow = {
  date: string;
  hasSelfReported: boolean;
  hasGithub: boolean;
  hasWakatime: boolean;
  hasLeetcode: boolean;
  isSeeded: boolean;
  githubDetailLevel: "calendar" | "detailed" | "migrated" | null;
  codingHoursSource: "wakatime" | "self" | null;
  problemsSolvedSource: "leetcode" | "self" | null;
  commitsByBucket: {
    night: number;
    morning: number;
    afternoon: number;
    evening: number;
  } | null;
} & Partial<Record<FieldKey, number | null>>;

export type RollingRow = {
  date: string;
  sampleSize: number;
  averages: Partial<Record<FieldKey, number | null>>;
  raw: DatasetRow | null;
};

export type DataQuality = {
  timezoneOffsetMinutes: number | null;
  lineFiltering: {
    additions: number;
    additionsRaw: number;
    deletions: number;
    deletionsRaw: number;
    filesChanged: number;
    filesExcluded: number;
    excludedShare: number;
  };
  totalDays: number;
  calendarDays: number;
  firstDate?: string;
  lastDate?: string;
  coverage: { both: number; selfOnly: number; githubOnly: number; missing: number };
  seededDays: number;
  outliers: {
    date: string;
    key: FieldKey;
    label: string;
    value: number;
    reason: string;
    bound: number;
  }[];
  fieldCompleteness: {
    key: FieldKey;
    label: string;
    source: FieldSource;
    present: number;
    completeness: number;
  }[];
  githubDetail: { calendar: number; detailed: number; migrated: number };
  longestGap: number;
  syncRuns: {
    kind: "calendar" | "detailed" | "migration";
    startDate: string;
    endDate: string;
    daysWritten: number;
    status: "ok" | "error";
    message: string | null;
    ranAt: number;
  }[];
};

export type PredictionResult = {
  sampleSize: number;
  lag?: number;
  predicted: number | null;
  low: number | null;
  high: number | null;
  slope: number | null;
  intercept: number | null;
  rSquared: number | null;
  slopeSe: number | null;
  slopeP: number | null;
  significant: boolean;
  alpha?: number;
  seededPairs: number;
  extrapolating?: boolean;
  observedRange?: { min: number; max: number };
  predictorSource?: FieldSource;
  outputSource?: FieldSource;
  minSample?: number;
  reason: string | null;
};

export type SummaryStats = {
  windowDays: number;
  codingHours: number;
  commits: number;
  avgSleep: number | null;
  daysLogged: number;
  daysWithGithub: number;
  seededDays: number;
};
