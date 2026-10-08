import { v } from "convex/values";

import { action, httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  friendlyAttendanceError,
  jsonResponse,
  randomToken,
  sha256Hex,
  slackLinkUrl,
  verifySlackRequest,
} from "./lib/slack";

function slackResponse(text: string, status = 200) {
  return jsonResponse({ response_type: "ephemeral", text }, status);
}

function parseCommand(text: string) {
  const [verb = "", code = ""] = text.trim().split(/\s+/);
  const normalizedVerb = verb.toLowerCase();

  if (normalizedVerb === "in" || normalizedVerb === "signin" || normalizedVerb === "sign-in") {
    return { action: "in" as const, code };
  }

  if (normalizedVerb === "out" || normalizedVerb === "signout" || normalizedVerb === "sign-out") {
    return { action: "out" as const, code };
  }

  return { action: "help" as const, code: "" };
}

async function createLinkMessage(
  ctx: ActionCtx,
  params: URLSearchParams,
) {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);

  await ctx.runMutation(internal.shopAttendance.createSlackLinkToken, {
    tokenHash,
    slackUserId: params.get("user_id") ?? "",
    slackTeamId: params.get("team_id") ?? undefined,
    slackUserName: params.get("user_name") ?? undefined,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
  });

  return [
    "Link your Slack account to Dolphin Apps first:",
    slackLinkUrl(token),
    "This link expires in 2 hours. After linking, run `/shop in CODE` or `/shop out CODE` again.",
  ].join("\n");
}

export const slackCommands = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return slackResponse("Use POST for Slack commands.", 405);
  }

  const rawBody = await request.text();

  if (!(await verifySlackRequest(request, rawBody))) {
    return slackResponse("Slack request verification failed.", 401);
  }

  const params = new URLSearchParams(rawBody);
  const slackUserId = params.get("user_id") ?? "";
  const { action: commandAction, code } = parseCommand(params.get("text") ?? "");

  if (!slackUserId) {
    return slackResponse("Slack did not include a user id.", 400);
  }

  if (commandAction === "help") {
    return slackResponse(
      "Use `/shop in CODE` to sign in or `/shop out CODE` to sign out. " +
        "You can also use the buttons on the Dolphin Apps Home tab (click the app's name in Slack).",
    );
  }

  if (!code) {
    return slackResponse("Add the current shop code from the shop screen.");
  }

  try {
    if (commandAction === "in") {
      const result = await ctx.runMutation(internal.shopAttendance.slackSignInWithCode, {
        slackUserId,
        code,
      });

      return slackResponse(
        `Signed in at ${new Date(result.signedInAt).toLocaleTimeString()}.`,
      );
    }

    const result = await ctx.runMutation(internal.shopAttendance.slackSignOutWithCode, {
      slackUserId,
      code,
    });

    return slackResponse(
      `Signed out at ${new Date(result.signedOutAt).toLocaleTimeString()} (${result.minutes} minutes).`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("SLACK_LINK_REQUIRED")) {
      return slackResponse(await createLinkMessage(ctx, params));
    }

    return slackResponse(friendlyAttendanceError(error));
  }
});

export const notifyShopSessionClosed = action({
  args: {
    completedCount: v.number(),
    flaggedCount: v.number(),
    closedAt: v.number(),
    flaggedStudentNames: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args) => {
    const token = process.env.SLACK_BOT_TOKEN;
    const channel = process.env.SLACK_ATTENDANCE_CHANNEL_ID;

    if (!token || !channel) {
      return { sent: false };
    }

    const names = args.flaggedStudentNames ?? [];
    const text = [
      `Shop session closed at ${new Date(args.closedAt).toLocaleString()}.`,
      `${args.completedCount} completed attendance record${args.completedCount === 1 ? "" : "s"}.`,
      args.flaggedCount > 0
        ? `${args.flaggedCount} student${args.flaggedCount === 1 ? "" : "s"} left signed in and need review${
            names.length > 0 ? `: ${names.join(", ")}` : ""
          }.`
        : "No attendance records need review.",
    ].join(" ");

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel, text }),
    });

    if (!response.ok) {
      return { sent: false };
    }

    const body = (await response.json()) as { ok?: boolean };

    return { sent: body.ok === true };
  },
});
