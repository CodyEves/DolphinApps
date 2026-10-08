// Shared helpers for every Slack endpoint (slash commands, events, interactivity).
// Runs in the default Convex runtime (Web Crypto + fetch), no Node APIs.

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function sha256Hex(value: string) {
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
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));

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

/** Verifies Slack's v0 request signature. `rawBody` must be the unparsed body text. */
export async function verifySlackRequest(request: Request, rawBody: string) {
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

export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function siteUrl() {
  const value = process.env.SITE_URL;

  if (!value) {
    throw new Error("SITE_URL is not configured.");
  }

  return value.replace(/\/$/, "");
}

export function slackLinkUrl(token: string) {
  return `${siteUrl()}/shop/link-slack?token=${encodeURIComponent(token)}`;
}

export type SlackApiResult = { ok: boolean; error?: string; [key: string]: unknown };

/**
 * Calls a Slack Web API method with the bot token. Never throws for Slack-level
 * errors; check `ok` on the result. Throws only when the token is missing.
 */
export async function slackApi(method: string, body: Record<string, unknown>): Promise<SlackApiResult> {
  const token = process.env.SLACK_BOT_TOKEN;

  if (!token) {
    throw new Error("SLACK_BOT_TOKEN is not configured.");
  }

  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return { ok: false, error: `http_${response.status}` };
  }

  return (await response.json()) as SlackApiResult;
}

/** GET-style Slack methods (users.list etc.) that take query params. */
export async function slackApiGet(method: string, params: Record<string, string>): Promise<SlackApiResult> {
  const token = process.env.SLACK_BOT_TOKEN;

  if (!token) {
    throw new Error("SLACK_BOT_TOKEN is not configured.");
  }

  const query = new URLSearchParams(params).toString();
  const response = await fetch(`https://slack.com/api/${method}?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { ok: false, error: `http_${response.status}` };
  }

  return (await response.json()) as SlackApiResult;
}

/** Escapes text for Slack mrkdwn (only &, <, > need escaping). */
export function escapeMrkdwn(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Turns a Convex mutation error into one short sentence for Slack. */
export function friendlyAttendanceError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("SLACK_LINK_REQUIRED")) {
    return "Connect your Dolphin Apps account first (Home tab → Connect my account).";
  }

  // Errors from runMutation look like:
  //   "[Request ID: abc] Server Error\nUncaught Error: That shop code is expired...\n    at handler (...)"
  // Keep only the human sentence.
  const uncaught = message.match(/Uncaught Error:\s*([^\n]+)/);
  const cleaned = (uncaught?.[1] ?? message)
    .replace(/^\[Request ID:[^\]]*\]\s*/i, "")
    .replace(/^Server Error\s*/i, "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("at "));

  return cleaned ? cleaned.slice(0, 200) : "Could not update shop attendance.";
}
