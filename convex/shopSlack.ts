import { v } from "convex/values";

import { action, httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function slackResponse(text: string, status = 200) {
  return jsonResponse({ response_type: "ephemeral", text }, status);
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );

  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(first: string, second: string) {
  if (first.length !== second.length) {
    return false;
  }

  let result = 0;

  for (let index = 0; index < first.length; index += 1) {
    result |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }

  return result === 0;
}

async function verifySlackRequest(request: Request, rawBody: string) {
  const secret = process.env.SLACK_SIGNING_SECRET;

  if (!secret) {
    return false;
  }

  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";
  const timestampSeconds = Number(timestamp);

  if (
    !signature.startsWith("v0=") ||
    !Number.isFinite(timestampSeconds) ||
    Math.abs(Date.now() / 1000 - timestampSeconds) > 60 * 5
  ) {
    return false;
  }

  const expected = `v0=${await hmacSha256Hex(secret, `v0:${timestamp}:${rawBody}`)}`;

  return constantTimeEqual(expected, signature);
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
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

function linkUrl(token: string) {
  const siteUrl = process.env.SITE_URL;

  if (!siteUrl) {
    throw new Error("SITE_URL is not configured.");
  }

  return `${siteUrl.replace(/\/$/, "")}/shop/link-slack?token=${encodeURIComponent(token)}`;
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
    expiresAt: Date.now() + 15 * 60 * 1000,
  });

  return [
    "Link your Slack account to Dolphin Apps first:",
    linkUrl(token),
    "After linking, run `/shop in CODE` or `/shop out CODE` again.",
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
    return slackResponse("Use `/shop in CODE` to sign in or `/shop out CODE` to sign out.");
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

    return slackResponse(
      error instanceof Error ? error.message : "Could not update shop attendance.",
    );
  }
});

export const notifyShopSessionClosed = action({
  args: {
    completedCount: v.number(),
    flaggedCount: v.number(),
    closedAt: v.number(),
  },
  handler: async (_ctx, args) => {
    const token = process.env.SLACK_BOT_TOKEN;
    const channel = process.env.SLACK_ATTENDANCE_CHANNEL_ID;

    if (!token || !channel) {
      return { sent: false };
    }

    const text = [
      `Shop session closed at ${new Date(args.closedAt).toLocaleString()}.`,
      `${args.completedCount} completed attendance record${args.completedCount === 1 ? "" : "s"}.`,
      args.flaggedCount > 0
        ? `${args.flaggedCount} student${args.flaggedCount === 1 ? "" : "s"} left signed in and need review.`
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
