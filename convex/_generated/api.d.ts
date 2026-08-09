/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as dailyLogs from "../dailyLogs.js";
import type * as github from "../github.js";
import type * as http from "../http.js";
import type * as lib_commitFiles from "../lib/commitFiles.js";
import type * as lib_fields from "../lib/fields.js";
import type * as lib_stats from "../lib/stats.js";
import type * as lib_thresholds from "../lib/thresholds.js";
import type * as maintenance from "../maintenance.js";
import type * as migrations from "../migrations.js";
import type * as predictions from "../predictions.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";
import type * as weeklySummary from "../weeklySummary.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  auth: typeof auth;
  dailyLogs: typeof dailyLogs;
  github: typeof github;
  http: typeof http;
  "lib/commitFiles": typeof lib_commitFiles;
  "lib/fields": typeof lib_fields;
  "lib/stats": typeof lib_stats;
  "lib/thresholds": typeof lib_thresholds;
  maintenance: typeof maintenance;
  migrations: typeof migrations;
  predictions: typeof predictions;
  seed: typeof seed;
  users: typeof users;
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
