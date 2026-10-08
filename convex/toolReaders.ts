import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { describeAccessReason, evaluateToolAccess } from "./lib/toolAccess";

const ENROLLMENT_WINDOW_MS = 2 * 60 * 1000;

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Card UIDs arrive from readers in whatever case and separator style the firmware uses.
 * Normalizing on the way in and out keeps lookups stable across reader models.
 */
export function normalizeCardUid(value: string) {
  return value.trim().toUpperCase().replace(/[^0-9A-F]/g, "");
}

async function currentProfile(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    return null;
  }

  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const profile = await currentProfile(ctx);

  if (profile?.role !== "admin" || profile.status !== "active") {
    throw new Error("Only admins can manage card readers.");
  }

  return profile;
}

function generateDeviceKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);

  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Active students plus whether a card is already bound, for the enrollment picker. */
export const listEnrollableStudents = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const students = await ctx.db
      .query("profiles")
      .withIndex("by_role_status", (q) => q.eq("role", "student").eq("status", "active"))
      .collect();

    return students
      .map((student) => ({
        userId: student.userId,
        name: student.displayName ?? student.email ?? "Unknown student",
        studentGroup: student.studentGroup,
        hasCard: Boolean(student.cardUid),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const listReaders = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const readers = await ctx.db.query("toolReaders").collect();

    return await Promise.all(
      readers.map(async (reader) => {
        const equipment = reader.equipmentId ? await ctx.db.get(reader.equipmentId) : null;

        return {
          ...reader,
          deviceKeyHash: undefined,
          equipmentName: equipment?.name ?? null,
        };
      }),
    );
  },
});

/**
 * Returns the plaintext device key exactly once, at creation. It is stored hashed, so it
 * cannot be recovered later — a lost key means rotating it.
 */
export const createReader = mutation({
  args: {
    name: v.string(),
    equipmentId: v.optional(v.id("equipment")),
  },
  handler: async (ctx, args) => {
    const profile = await requireAdmin(ctx);

    const name = args.name.trim();

    if (!name) {
      throw new Error("Give the reader a name.");
    }

    const deviceKey = generateDeviceKey();
    const now = Date.now();

    const readerId = await ctx.db.insert("toolReaders", {
      name,
      equipmentId: args.equipmentId,
      deviceKeyHash: await sha256Hex(deviceKey),
      deviceKeyPreview: `${deviceKey.slice(0, 6)}...${deviceKey.slice(-4)}`,
      isActive: true,
      createdBy: profile.userId,
      createdAt: now,
      updatedAt: now,
    });

    return { readerId, deviceKey };
  },
});

export const updateReader = mutation({
  args: {
    readerId: v.id("toolReaders"),
    name: v.optional(v.string()),
    equipmentId: v.optional(v.union(v.id("equipment"), v.null())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const reader = await ctx.db.get(args.readerId);

    if (!reader) {
      throw new Error("Reader not found.");
    }

    await ctx.db.patch(args.readerId, {
      ...(args.name !== undefined ? { name: args.name.trim() || reader.name } : {}),
      ...(args.equipmentId !== undefined
        ? { equipmentId: args.equipmentId ?? undefined }
        : {}),
      ...(args.isActive !== undefined ? { isActive: args.isActive } : {}),
      updatedAt: Date.now(),
    });
  },
});

export const rotateReaderKey = mutation({
  args: { readerId: v.id("toolReaders") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const reader = await ctx.db.get(args.readerId);

    if (!reader) {
      throw new Error("Reader not found.");
    }

    const deviceKey = generateDeviceKey();

    await ctx.db.patch(args.readerId, {
      deviceKeyHash: await sha256Hex(deviceKey),
      deviceKeyPreview: `${deviceKey.slice(0, 6)}...${deviceKey.slice(-4)}`,
      updatedAt: Date.now(),
    });

    return { deviceKey };
  },
});

export const deleteReader = mutation({
  args: { readerId: v.id("toolReaders") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.readerId);
  },
});

export const listRecentAccessEvents = query({
  args: {
    equipmentId: v.optional(v.id("equipment")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = Math.min(args.limit ?? 50, 200);
    const events = args.equipmentId
      ? await ctx.db
          .query("toolAccessEvents")
          .withIndex("by_equipment", (q) => q.eq("equipmentId", args.equipmentId))
          .order("desc")
          .take(limit)
      : await ctx.db.query("toolAccessEvents").withIndex("by_created").order("desc").take(limit);

    return await Promise.all(
      events.map(async (event) => {
        const equipment = event.equipmentId ? await ctx.db.get(event.equipmentId) : null;
        const profile = event.userId
          ? await ctx.db
              .query("profiles")
              .withIndex("by_user", (q) => q.eq("userId", event.userId!))
              .unique()
          : null;

        return {
          ...event,
          equipmentName: equipment?.name ?? null,
          studentName: profile?.displayName ?? profile?.email ?? null,
          reasonLabel: describeAccessReason(event.reason),
        };
      }),
    );
  },
});

/* --------------------------------------------------------------------------
 * Card enrollment: an admin opens a short window, the student taps their card
 * on any reader, and the reader's enroll call binds the UID to that student.
 * ------------------------------------------------------------------------ */

export const startCardEnrollment = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await requireAdmin(ctx);
    const now = Date.now();

    // Only one window can be open at a time, otherwise a tap is ambiguous.
    const waiting = await ctx.db
      .query("cardEnrollmentSessions")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .collect();

    for (const session of waiting) {
      await ctx.db.patch(session._id, {
        status: session.expiresAt <= now ? "expired" : "canceled",
      });
    }

    return await ctx.db.insert("cardEnrollmentSessions", {
      targetUserId: args.targetUserId,
      requestedBy: profile.userId,
      status: "waiting",
      expiresAt: now + ENROLLMENT_WINDOW_MS,
      createdAt: now,
    });
  },
});

export const cancelCardEnrollment = mutation({
  args: { sessionId: v.id("cardEnrollmentSessions") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const session = await ctx.db.get(args.sessionId);

    if (session?.status === "waiting") {
      await ctx.db.patch(args.sessionId, { status: "canceled" });
    }
  },
});

export const watchCardEnrollment = query({
  args: { sessionId: v.id("cardEnrollmentSessions") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const session = await ctx.db.get(args.sessionId);

    if (!session) {
      return null;
    }

    return {
      ...session,
      status:
        session.status === "waiting" && session.expiresAt <= Date.now()
          ? ("expired" as const)
          : session.status,
    };
  },
});

/**
 * Manual fallback for when a card can be read by other means (or needs clearing).
 */
export const setCardUid = mutation({
  args: {
    targetUserId: v.id("users"),
    cardUid: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const profile = await requireAdmin(ctx);

    const target = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();

    if (!target) {
      throw new Error("Student profile not found.");
    }

    const now = Date.now();

    if (args.cardUid === null) {
      await ctx.db.patch(target._id, {
        cardUid: undefined,
        cardEnrolledAt: undefined,
        cardEnrolledBy: undefined,
        updatedAt: now,
      });

      return;
    }

    const cardUid = normalizeCardUid(args.cardUid);

    if (!cardUid) {
      throw new Error("That card number is not readable.");
    }

    const conflict = await ctx.db
      .query("profiles")
      .withIndex("by_card_uid", (q) => q.eq("cardUid", cardUid))
      .unique();

    if (conflict && conflict._id !== target._id) {
      throw new Error(
        `That card is already assigned to ${conflict.displayName ?? conflict.email ?? "another student"}.`,
      );
    }

    await ctx.db.patch(target._id, {
      cardUid,
      cardEnrolledAt: now,
      cardEnrolledBy: profile.userId,
      updatedAt: now,
    });
  },
});

/* --------------------------------------------------------------------------
 * Internal mutations called by the reader HTTP endpoints in http.ts.
 * ------------------------------------------------------------------------ */

async function readerForKey(ctx: MutationCtx, deviceKey: string) {
  const reader = await ctx.db
    .query("toolReaders")
    .withIndex("by_device_key_hash", (q) => q.eq("deviceKeyHash", deviceKey))
    .unique();

  if (!reader || !reader.isActive) {
    return null;
  }

  return reader;
}

export const readerCheckAccess = internalMutation({
  args: {
    deviceKeyHash: v.string(),
    cardUid: v.string(),
  },
  handler: async (ctx, args) => {
    const reader = await readerForKey(ctx, args.deviceKeyHash);

    if (!reader) {
      return { authorized: false as const };
    }

    const now = Date.now();
    await ctx.db.patch(reader._id, { lastSeenAt: now });

    const cardUid = normalizeCardUid(args.cardUid);
    const equipment = reader.equipmentId ? await ctx.db.get(reader.equipmentId) : null;

    const profile = cardUid
      ? await ctx.db
          .query("profiles")
          .withIndex("by_card_uid", (q) => q.eq("cardUid", cardUid))
          .unique()
      : null;

    if (!equipment) {
      await ctx.db.insert("toolAccessEvents", {
        readerId: reader._id,
        cardUid,
        userId: profile?.userId,
        decision: "denied",
        reason: "equipment_inactive",
        createdAt: now,
      });

      return {
        authorized: true as const,
        allowed: false,
        reason: "equipment_inactive" as const,
        message: "This reader is not assigned to a tool yet.",
        studentName: null,
        toolName: null,
      };
    }

    if (!profile) {
      await ctx.db.insert("toolAccessEvents", {
        equipmentId: equipment._id,
        readerId: reader._id,
        cardUid,
        decision: "denied",
        reason: "unknown_card",
        createdAt: now,
      });

      return {
        authorized: true as const,
        allowed: false,
        reason: "unknown_card" as const,
        message: describeAccessReason("unknown_card"),
        studentName: null,
        toolName: equipment.name,
      };
    }

    const result = await evaluateToolAccess(ctx, equipment._id, profile.userId, now);

    await ctx.db.insert("toolAccessEvents", {
      equipmentId: equipment._id,
      readerId: reader._id,
      cardUid,
      userId: profile.userId,
      decision: result.allowed ? "allowed" : "denied",
      reason: result.reason,
      createdAt: now,
    });

    return {
      authorized: true as const,
      allowed: result.allowed,
      reason: result.reason,
      message: describeAccessReason(result.reason),
      studentName: profile.displayName ?? profile.email ?? null,
      toolName: equipment.name,
    };
  },
});

export const readerEnrollCard = internalMutation({
  args: {
    deviceKeyHash: v.string(),
    cardUid: v.string(),
  },
  handler: async (ctx, args) => {
    const reader = await readerForKey(ctx, args.deviceKeyHash);

    if (!reader) {
      return { authorized: false as const };
    }

    const now = Date.now();
    await ctx.db.patch(reader._id, { lastSeenAt: now });

    const cardUid = normalizeCardUid(args.cardUid);

    if (!cardUid) {
      return { authorized: true as const, enrolled: false, message: "Card was not readable." };
    }

    const session = await ctx.db
      .query("cardEnrollmentSessions")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .first();

    if (!session) {
      return {
        authorized: true as const,
        enrolled: false,
        message: "No enrollment is open. Start one on the website first.",
      };
    }

    if (session.expiresAt <= now) {
      await ctx.db.patch(session._id, { status: "expired" });

      return {
        authorized: true as const,
        enrolled: false,
        message: "The enrollment window expired. Start a new one.",
      };
    }

    const target = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", session.targetUserId))
      .unique();

    if (!target) {
      await ctx.db.patch(session._id, { status: "canceled" });

      return { authorized: true as const, enrolled: false, message: "Student profile not found." };
    }

    const conflict = await ctx.db
      .query("profiles")
      .withIndex("by_card_uid", (q) => q.eq("cardUid", cardUid))
      .unique();

    if (conflict && conflict._id !== target._id) {
      return {
        authorized: true as const,
        enrolled: false,
        message: "That card is already assigned to another student.",
      };
    }

    await ctx.db.patch(target._id, {
      cardUid,
      cardEnrolledAt: now,
      cardEnrolledBy: session.requestedBy,
      updatedAt: now,
    });

    await ctx.db.patch(session._id, {
      status: "completed",
      cardUid,
      completedAt: now,
    });

    return {
      authorized: true as const,
      enrolled: true,
      message: `Card assigned to ${target.displayName ?? target.email ?? "student"}.`,
    };
  },
});
