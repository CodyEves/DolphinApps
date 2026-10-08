import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { friendlyAttendanceError, jsonResponse, slackApi, verifySlackRequest } from "./lib/slack";
import {
  ACTION_HOME_REFRESH,
  ACTION_SHOP_SIGN_IN,
  ACTION_SHOP_SIGN_OUT,
  SHOP_CODE_BLOCK,
  SHOP_CODE_INPUT,
  SHOP_CODE_MODAL,
  buildMessageModal,
  buildShopCodeModal,
} from "./slackHome";

// Slack wants a 200 within 3 seconds. Anything slow (building the Home tab)
// is pushed to the scheduler and runs right after we respond.

const ok = () => new Response(null, { status: 200 });

/** Events API: POST /slack/events */
export const slackEvents = httpAction(async (ctx, request) => {
  const rawBody = await request.text();

  if (!(await verifySlackRequest(request, rawBody))) {
    return new Response("Slack request verification failed.", { status: 401 });
  }

  let body: {
    type?: string;
    challenge?: string;
    event?: { type?: string; user?: string; tab?: string };
  };

  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  if (body.type === "url_verification") {
    return jsonResponse({ challenge: body.challenge });
  }

  if (body.type === "event_callback" && body.event?.type === "app_home_opened") {
    if (body.event.tab === "home" && body.event.user) {
      await ctx.scheduler.runAfter(0, internal.slackHome.publishHome, {
        slackUserId: body.event.user,
      });
    }
  }

  return ok();
});

type InteractionPayload = {
  type?: string;
  trigger_id?: string;
  user?: { id?: string };
  actions?: { action_id?: string }[];
  view?: {
    callback_id?: string;
    private_metadata?: string;
    state?: { values?: Record<string, Record<string, { value?: string | null }>> };
  };
};

/** Interactivity: POST /slack/interactions (buttons + modal submissions) */
export const slackInteractions = httpAction(async (ctx, request) => {
  const rawBody = await request.text();

  if (!(await verifySlackRequest(request, rawBody))) {
    return new Response("Slack request verification failed.", { status: 401 });
  }

  let payload: InteractionPayload;

  try {
    payload = JSON.parse(new URLSearchParams(rawBody).get("payload") ?? "{}");
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  const slackUserId = payload.user?.id;

  if (!slackUserId) {
    return ok();
  }

  // ---- Button clicks ---------------------------------------------------
  if (payload.type === "block_actions") {
    const actionId = payload.actions?.[0]?.action_id;

    if ((actionId === ACTION_SHOP_SIGN_IN || actionId === ACTION_SHOP_SIGN_OUT) && payload.trigger_id) {
      // trigger_id expires after 3 seconds, so open the modal inline.
      const result = await slackApi("views.open", {
        trigger_id: payload.trigger_id,
        view: buildShopCodeModal(actionId === ACTION_SHOP_SIGN_IN ? "in" : "out"),
      });

      if (!result.ok) {
        console.error("views.open failed", result.error);
      }
    } else if (actionId === ACTION_HOME_REFRESH) {
      await ctx.scheduler.runAfter(0, internal.slackHome.publishHome, { slackUserId });
    }

    // URL buttons (Open Dolphin Apps, Connect my account) also land here; just ack.
    return ok();
  }

  // ---- Modal submit: shop code ------------------------------------------
  if (payload.type === "view_submission" && payload.view?.callback_id === SHOP_CODE_MODAL) {
    let action: "in" | "out" = "in";

    try {
      action = JSON.parse(payload.view.private_metadata ?? "{}").action === "out" ? "out" : "in";
    } catch {
      // default to sign-in
    }

    const code = payload.view.state?.values?.[SHOP_CODE_BLOCK]?.[SHOP_CODE_INPUT]?.value?.trim() ?? "";

    if (!code) {
      return jsonResponse({
        response_action: "errors",
        errors: { [SHOP_CODE_BLOCK]: "Enter the code from the shop screen." },
      });
    }

    try {
      if (action === "in") {
        await ctx.runMutation(internal.shopAttendance.slackSignInWithCode, { slackUserId, code });

        return jsonResponse({
          response_action: "update",
          view: buildMessageModal("Signed in", "You're signed in to the shop. Have a good session!"),
        });
      }

      const result = await ctx.runMutation(internal.shopAttendance.slackSignOutWithCode, {
        slackUserId,
        code,
      });
      const minutes = result.minutes;
      const length = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;

      return jsonResponse({
        response_action: "update",
        view: buildMessageModal("Signed out", `You're signed out. Session length: *${length}*.`),
      });
    } catch (error) {
      return jsonResponse({
        response_action: "errors",
        errors: { [SHOP_CODE_BLOCK]: friendlyAttendanceError(error) },
      });
    }
  }

  return ok();
});
