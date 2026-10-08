import { httpRouter } from "convex/server";

import { auth } from "./auth";
import { readerCheck, readerEnroll } from "./readerApi";
import { slackEvents, slackInteractions } from "./slackEvents";
import { slackCommands } from "./shopSlack";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/slack/commands",
  method: "POST",
  handler: slackCommands,
});

http.route({
  path: "/slack/events",
  method: "POST",
  handler: slackEvents,
});

http.route({
  path: "/slack/interactions",
  method: "POST",
  handler: slackInteractions,
});

http.route({
  path: "/reader/check",
  method: "POST",
  handler: readerCheck,
});

http.route({
  path: "/reader/enroll",
  method: "POST",
  handler: readerEnroll,
});

export default http;
