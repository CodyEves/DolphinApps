import { httpRouter } from "convex/server";

import { auth } from "./auth";
import { slackCommands } from "./shopSlack";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/slack/commands",
  method: "POST",
  handler: slackCommands,
});

export default http;
