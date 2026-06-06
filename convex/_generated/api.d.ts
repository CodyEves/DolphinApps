/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as adminLms from "../adminLms.js";
import type * as auth from "../auth.js";
import type * as badges from "../badges.js";
import type * as catalog from "../catalog.js";
import type * as dashboard from "../dashboard.js";
import type * as demo from "../demo.js";
import type * as equipment from "../equipment.js";
import type * as http from "../http.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_parts from "../lib/parts.js";
import type * as lib_profanity from "../lib/profanity.js";
import type * as lib_programs from "../lib/programs.js";
import type * as lib_validators from "../lib/validators.js";
import type * as orderRequests from "../orderRequests.js";
import type * as parts from "../parts.js";
import type * as profiles from "../profiles.js";
import type * as setup from "../setup.js";
import type * as shopAttendance from "../shopAttendance.js";
import type * as shopSlack from "../shopSlack.js";
import type * as subsystems from "../subsystems.js";
import type * as training from "../training.js";
import type * as transmissions from "../transmissions.js";
import type * as websiteBuilder from "../websiteBuilder.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  adminLms: typeof adminLms;
  auth: typeof auth;
  badges: typeof badges;
  catalog: typeof catalog;
  dashboard: typeof dashboard;
  demo: typeof demo;
  equipment: typeof equipment;
  http: typeof http;
  "lib/authz": typeof lib_authz;
  "lib/parts": typeof lib_parts;
  "lib/profanity": typeof lib_profanity;
  "lib/programs": typeof lib_programs;
  "lib/validators": typeof lib_validators;
  orderRequests: typeof orderRequests;
  parts: typeof parts;
  profiles: typeof profiles;
  setup: typeof setup;
  shopAttendance: typeof shopAttendance;
  shopSlack: typeof shopSlack;
  subsystems: typeof subsystems;
  training: typeof training;
  transmissions: typeof transmissions;
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
