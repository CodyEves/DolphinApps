import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { friendlyAttendanceError, jsonResponse, slackApi, verifySlackRequest } from "./lib/slack";
import { ACTION_CORRECTION_APPROVE, ACTION_CORRECTION_DENY } from "./attendanceCorrections";
import {
  ACTION_FIX_TIME,
  ACTION_HOME_REFRESH,
  ACTION_MISSED_SESSION,
  ACTION_SHOP_SIGN_IN,
  ACTION_SHOP_SIGN_OUT,
  SHOP_CODE_BLOCK,
  SHOP_CODE_INPUT,
  SHOP_CODE_MODAL,
  FIX_TIME_MODAL,
  MISSED_SESSION_MODAL,
  PICKER_INPUT,
  REASON_BLOCK,
  REASON_INPUT,
  SIGN_IN_BLOCK,
  SIGN_OUT_BLOCK,
  buildFixTimeModal,
  buildMessageModal,
  buildMissedSessionModal,
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
  response_url?: string;
  actions?: { action_id?: string; value?: string }[];
  view?: {
    callback_id?: string;
    private_metadata?: string;
    state?: {
      values?: Record<
        string,
        Record<string, { value?: string | null; selected_date_time?: number | null }>
      >;
    };
  };
};

type ViewState = NonNullable<NonNullable<InteractionPayload["view"]>["state"]>;

function pickedTime(state: ViewState | undefined, blockId: string) {
  const seconds = state?.values?.[blockId]?.[PICKER_INPUT]?.selected_date_time;
  return typeof seconds === "number" ? seconds * 1000 : null;
}

function textValue(state: ViewState | undefined, blockId: string, actionId: string) {
  return state?.values?.[blockId]?.[actionId]?.value?.trim() ?? "";
}

/** Short private reply under a message (used for approve/deny problems). */
async function ephemeralReply(responseUrl: string | undefined, text: string) {
  if (!responseUrl) return;

  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response_type: "ephemeral", replace_original: false, text }),
  });
}

const sentModal = (kind: string) =>
  jsonResponse({
    response_action: "update",
    view: buildMessageModal(
      "Request sent",
      `Your ${kind} request went to the mentors. You'll get a message here when it's approved or denied.`,
    ),
  });

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
    } else if (actionId === ACTION_FIX_TIME && payload.trigger_id) {
      let view;

      try {
        const context = await ctx.runQuery(internal.attendanceCorrections.fixModalContext, {
          slackUserId,
          attendanceSessionId: payload.actions?.[0]?.value ?? "",
        });
        view = buildFixTimeModal(context);
      } catch (error) {
        view = buildMessageModal("Can't fix that one", friendlyAttendanceError(error));
        await ctx.scheduler.runAfter(0, internal.slackHome.publishHome, { slackUserId });
      }

      const result = await slackApi("views.open", { trigger_id: payload.trigger_id, view });

      if (!result.ok) {
        console.error("views.open (fix time) failed", result.error);
      }
    } else if (actionId === ACTION_MISSED_SESSION && payload.trigger_id) {
      const result = await slackApi("views.open", {
        trigger_id: payload.trigger_id,
        view: buildMissedSessionModal(),
      });

      if (!result.ok) {
        console.error("views.open (missed session) failed", result.error);
      }
    } else if (actionId === ACTION_CORRECTION_APPROVE || actionId === ACTION_CORRECTION_DENY) {
      try {
        const result = await ctx.runMutation(internal.attendanceCorrections.decide, {
          correctionId: payload.actions?.[0]?.value ?? "",
          reviewerSlackUserId: slackUserId,
          approve: actionId === ACTION_CORRECTION_APPROVE,
        });

        if (result.alreadyDecided) {
          await ephemeralReply(payload.response_url, `Someone already ${result.status} this request.`);
        }
      } catch (error) {
        await ephemeralReply(payload.response_url, friendlyAttendanceError(error));
      }
    }

    // URL buttons (Open Dolphin Apps, Connect my account) also land here; just ack.
    return ok();
  }

  // ---- Modal submit: fix sign-out time -----------------------------------
  if (payload.type === "view_submission" && payload.view?.callback_id === FIX_TIME_MODAL) {
    const state = payload.view.state;
    const signOutAt = pickedTime(state, SIGN_OUT_BLOCK);
    let attendanceSessionId = "";

    try {
      attendanceSessionId = JSON.parse(payload.view.private_metadata ?? "{}").attendanceSessionId ?? "";
    } catch {
      // handled below
    }

    if (!signOutAt) {
      return jsonResponse({
        response_action: "errors",
        errors: { [SIGN_OUT_BLOCK]: "Pick the date and time you left." },
      });
    }

    try {
      await ctx.runMutation(internal.attendanceCorrections.requestFix, {
        slackUserId,
        attendanceSessionId,
        signOutAt,
        reason: textValue(state, REASON_BLOCK, REASON_INPUT),
      });

      return sentModal("time fix");
    } catch (error) {
      const message = friendlyAttendanceError(error);
      const block = /reason/i.test(message) ? REASON_BLOCK : SIGN_OUT_BLOCK;

      return jsonResponse({ response_action: "errors", errors: { [block]: message } });
    }
  }

  // ---- Modal submit: missed session ------------------------------------
  if (payload.type === "view_submission" && payload.view?.callback_id === MISSED_SESSION_MODAL) {
    const state = payload.view.state;
    const signInAt = pickedTime(state, SIGN_IN_BLOCK);
    const signOutAt = pickedTime(state, SIGN_OUT_BLOCK);

    if (!signInAt || !signOutAt) {
      return jsonResponse({
        response_action: "errors",
        errors: {
          ...(!signInAt ? { [SIGN_IN_BLOCK]: "Pick when you arrived." } : {}),
          ...(!signOutAt ? { [SIGN_OUT_BLOCK]: "Pick when you left." } : {}),
        },
      });
    }

    try {
      await ctx.runMutation(internal.attendanceCorrections.requestMissed, {
        slackUserId,
        signInAt,
        signOutAt,
        reason: textValue(state, REASON_BLOCK, REASON_INPUT),
      });

      return sentModal("missed sign-in");
    } catch (error) {
      const message = friendlyAttendanceError(error);
      const block = /reason/i.test(message)
        ? REASON_BLOCK
        : /arriv|sign-in|shop wasn't open|overlap|last \d+ days/i.test(message)
          ? SIGN_IN_BLOCK
          : SIGN_OUT_BLOCK;

      return jsonResponse({ response_action: "errors", errors: { [block]: message } });
    }
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
