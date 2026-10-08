import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export type ToolAccessReason =
  | "approved"
  | "unknown_card"
  | "inactive_account"
  | "no_sign_off"
  | "sign_off_expired"
  | "equipment_inactive"
  | "equipment_locked_out";

/**
 * A sign-off only counts while it is approved and not past its expiry. Equipment with
 * `certificationValidDays` stamps `expiresAt` at approval time; older records without an
 * expiry never lapse.
 */
export function isSignOffCurrent(
  signOff: Pick<Doc<"equipmentSignOffs">, "status" | "expiresAt"> | null | undefined,
  now = Date.now(),
) {
  if (!signOff || signOff.status !== "approved") {
    return false;
  }

  return signOff.expiresAt === undefined || signOff.expiresAt > now;
}

export function isSignOffExpired(
  signOff: Pick<Doc<"equipmentSignOffs">, "status" | "expiresAt"> | null | undefined,
  now = Date.now(),
) {
  if (!signOff) {
    return false;
  }

  if (signOff.status === "expired") {
    return true;
  }

  return (
    signOff.status === "approved" &&
    signOff.expiresAt !== undefined &&
    signOff.expiresAt <= now
  );
}

export function expiryForEquipment(
  equipment: Pick<Doc<"equipment">, "certificationValidDays">,
  approvedAt: number,
) {
  const days = equipment.certificationValidDays;

  if (!days || days <= 0) {
    return undefined;
  }

  return approvedAt + days * 24 * 60 * 60 * 1000;
}

/**
 * The single source of truth the card reader and the UI both use to answer
 * "may this person run this machine right now?".
 */
export async function evaluateToolAccess(
  ctx: Ctx,
  equipmentId: Id<"equipment">,
  userId: Id<"users">,
  now = Date.now(),
): Promise<{ allowed: boolean; reason: ToolAccessReason }> {
  const equipment = await ctx.db.get(equipmentId);

  if (!equipment || !equipment.isActive) {
    return { allowed: false, reason: "equipment_inactive" };
  }

  if (equipment.isLockedOut) {
    return { allowed: false, reason: "equipment_locked_out" };
  }

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  if (!profile || profile.status !== "active") {
    return { allowed: false, reason: "inactive_account" };
  }

  const signOff = await ctx.db
    .query("equipmentSignOffs")
    .withIndex("by_user_equipment", (q) =>
      q.eq("userId", userId).eq("equipmentId", equipmentId),
    )
    .unique();

  if (isSignOffCurrent(signOff, now)) {
    return { allowed: true, reason: "approved" };
  }

  if (isSignOffExpired(signOff, now)) {
    return { allowed: false, reason: "sign_off_expired" };
  }

  return { allowed: false, reason: "no_sign_off" };
}

export function describeAccessReason(reason: ToolAccessReason) {
  switch (reason) {
    case "approved":
      return "Signed off";
    case "unknown_card":
      return "Card not recognized";
    case "inactive_account":
      return "Account is not active";
    case "no_sign_off":
      return "Not signed off on this tool";
    case "sign_off_expired":
      return "Sign-off has expired";
    case "equipment_inactive":
      return "Tool is not active";
    case "equipment_locked_out":
      return "Tool is locked out";
  }
}
