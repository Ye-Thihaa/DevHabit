/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accuracy from "../accuracy.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as burnout from "../burnout.js";
import type * as burnoutHistory from "../burnoutHistory.js";
import type * as crons from "../crons.js";
import type * as dailyLogs from "../dailyLogs.js";
import type * as github from "../github.js";
import type * as http from "../http.js";
import type * as leetcode from "../leetcode.js";
import type * as lib_commitFiles from "../lib/commitFiles.js";
import type * as lib_fields from "../lib/fields.js";
import type * as lib_llm from "../lib/llm.js";
import type * as lib_stats from "../lib/stats.js";
import type * as lib_thresholds from "../lib/thresholds.js";
import type * as maintenance from "../maintenance.js";
import type * as migrations from "../migrations.js";
import type * as predictions from "../predictions.js";
import type * as profile from "../profile.js";
import type * as seed from "../seed.js";
import type * as streaks from "../streaks.js";
import type * as users from "../users.js";
import type * as wakatime from "../wakatime.js";
import type * as weeklySummary from "../weeklySummary.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accuracy: typeof accuracy;
  analytics: typeof analytics;
  auth: typeof auth;
  burnout: typeof burnout;
  burnoutHistory: typeof burnoutHistory;
  crons: typeof crons;
  dailyLogs: typeof dailyLogs;
  github: typeof github;
  http: typeof http;
  leetcode: typeof leetcode;
  "lib/commitFiles": typeof lib_commitFiles;
  "lib/fields": typeof lib_fields;
  "lib/llm": typeof lib_llm;
  "lib/stats": typeof lib_stats;
  "lib/thresholds": typeof lib_thresholds;
  maintenance: typeof maintenance;
  migrations: typeof migrations;
  predictions: typeof predictions;
  profile: typeof profile;
  seed: typeof seed;
  streaks: typeof streaks;
  users: typeof users;
  wakatime: typeof wakatime;
  weeklySummary: typeof weeklySummary;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
