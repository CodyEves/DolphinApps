/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminLms from "../adminLms.js";
import type * as auth from "../auth.js";
import type * as badges from "../badges.js";
import type * as demo from "../demo.js";
import type * as equipment from "../equipment.js";
import type * as http from "../http.js";
import type * as profiles from "../profiles.js";
import type * as training from "../training.js";
import type * as websiteBuilder from "../websiteBuilder.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminLms: typeof adminLms;
  auth: typeof auth;
  badges: typeof badges;
  demo: typeof demo;
  equipment: typeof equipment;
  http: typeof http;
  profiles: typeof profiles;
  training: typeof training;
  websiteBuilder: typeof websiteBuilder;
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
