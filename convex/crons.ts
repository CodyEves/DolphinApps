import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "shop attendance automation",
  { minutes: 5 },
  internal.shopAttendance.runShopAutomation,
);

export default crons;
