import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

/**
 * HTTP surface for shop tool card readers.
 *
 * A reader is a small device wired to the tool's contactor. It holds a device key issued
 * once from the admin UI, and posts the tapped card's UID here. Nothing on the device
 * decides access; the deployment does, so revoking a sign-off takes effect on the next tap.
 */

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const jsonHeaders = { "Content-Type": "application/json" } as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

/**
 * The device key may travel either as `Authorization: Bearer <key>` or in the JSON body,
 * since not every reader firmware makes custom headers easy.
 */
async function readRequest(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const header = request.headers.get("Authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const deviceKey = bearer || (typeof body.deviceKey === "string" ? body.deviceKey : "");
  const cardUid = typeof body.cardUid === "string" ? body.cardUid : "";

  return { deviceKey, cardUid };
}

export const readerCheck = httpAction(async (ctx, request) => {
  const { deviceKey, cardUid } = await readRequest(request);

  if (!deviceKey || !cardUid) {
    return json({ allowed: false, reason: "bad_request", message: "Missing device key or card." }, 400);
  }

  const result = await ctx.runMutation(internal.toolReaders.readerCheckAccess, {
    deviceKeyHash: await sha256Hex(deviceKey),
    cardUid,
  });

  if (!result.authorized) {
    return json({ allowed: false, reason: "unauthorized_device", message: "Unknown reader." }, 401);
  }

  return json({
    allowed: result.allowed,
    reason: result.reason,
    message: result.message,
    studentName: result.studentName,
    toolName: result.toolName,
  });
});

export const readerEnroll = httpAction(async (ctx, request) => {
  const { deviceKey, cardUid } = await readRequest(request);

  if (!deviceKey || !cardUid) {
    return json({ enrolled: false, message: "Missing device key or card." }, 400);
  }

  const result = await ctx.runMutation(internal.toolReaders.readerEnrollCard, {
    deviceKeyHash: await sha256Hex(deviceKey),
    cardUid,
  });

  if (!result.authorized) {
    return json({ enrolled: false, message: "Unknown reader." }, 401);
  }

  return json({ enrolled: result.enrolled, message: result.message });
});
