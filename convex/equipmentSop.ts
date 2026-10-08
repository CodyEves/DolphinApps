import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const sopStepValidator = v.object({
  title: v.string(),
  detail: v.optional(v.string()),
  imageStorageId: v.optional(v.id("_storage")),
});

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

async function requireSopEditor(ctx: QueryCtx | MutationCtx) {
  const profile = await currentProfile(ctx);

  if (!profile || profile.status !== "active") {
    throw new Error("Your team profile is not active.");
  }

  if (profile.role !== "admin" && profile.role !== "mentor" && profile.role !== "instructor") {
    throw new Error("Only admins, mentors, and instructors can edit SOPs.");
  }

  return profile;
}

async function requireActiveProfile(ctx: QueryCtx | MutationCtx) {
  const profile = await currentProfile(ctx);

  if (!profile || profile.status !== "active") {
    throw new Error("Your team profile is not active.");
  }

  return profile;
}

async function getSop(ctx: QueryCtx | MutationCtx, equipmentId: Id<"equipment">) {
  return await ctx.db
    .query("equipmentSops")
    .withIndex("by_equipment", (q) => q.eq("equipmentId", equipmentId))
    .unique();
}

async function withStepImageUrls(ctx: QueryCtx | MutationCtx, sop: Doc<"equipmentSops">) {
  const steps = await Promise.all(
    sop.steps.map(async (step) => ({
      ...step,
      imageUrl: step.imageStorageId ? await ctx.storage.getUrl(step.imageStorageId) : null,
    })),
  );

  return { ...sop, steps };
}

function trimList(values: string[]) {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

/**
 * The SOP as a student sees it, plus whether they have acknowledged the current version.
 * Editors also get unpublished drafts; everyone else only sees a published SOP.
 */
export const getEquipmentSop = query({
  args: { equipmentId: v.id("equipment") },
  handler: async (ctx, args) => {
    const profile = await currentProfile(ctx);

    if (!profile) {
      return null;
    }

    const canEdit =
      profile.status === "active" &&
      (profile.role === "admin" || profile.role === "mentor" || profile.role === "instructor");

    const sop = await getSop(ctx, args.equipmentId);

    if (!sop || (!sop.isPublished && !canEdit)) {
      return { sop: null, canEdit, acknowledgement: null };
    }

    const acknowledgement = await ctx.db
      .query("equipmentSopAcknowledgements")
      .withIndex("by_user_equipment", (q) =>
        q.eq("userId", profile.userId).eq("equipmentId", args.equipmentId),
      )
      .order("desc")
      .first();

    return {
      sop: await withStepImageUrls(ctx, sop),
      canEdit,
      acknowledgement,
      hasAcknowledgedCurrentVersion:
        acknowledgement !== null && acknowledgement.sopVersion === sop.version,
    };
  },
});

/**
 * Everyone who has acknowledged this tool's SOP, newest first, for the admin roster.
 */
export const listSopAcknowledgements = query({
  args: { equipmentId: v.id("equipment") },
  handler: async (ctx, args) => {
    await requireSopEditor(ctx);

    const acknowledgements = await ctx.db
      .query("equipmentSopAcknowledgements")
      .withIndex("by_equipment", (q) => q.eq("equipmentId", args.equipmentId))
      .collect();

    return await Promise.all(
      acknowledgements.map(async (acknowledgement) => {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", acknowledgement.userId))
          .unique();

        return {
          ...acknowledgement,
          studentName: profile?.displayName ?? profile?.email ?? "Unknown student",
        };
      }),
    );
  },
});

export const saveEquipmentSop = mutation({
  args: {
    equipmentId: v.id("equipment"),
    summary: v.optional(v.string()),
    ppe: v.array(v.string()),
    hazards: v.array(v.string()),
    steps: v.array(sopStepValidator),
    beforeUse: v.array(v.string()),
    afterUse: v.array(v.string()),
    publish: v.boolean(),
  },
  handler: async (ctx, args) => {
    const profile = await requireSopEditor(ctx);

    const equipment = await ctx.db.get(args.equipmentId);

    if (!equipment) {
      throw new Error("Equipment not found.");
    }

    const now = Date.now();
    const existing = await getSop(ctx, args.equipmentId);
    const steps = args.steps
      .map((step) => ({
        title: step.title.trim(),
        detail: step.detail?.trim() || undefined,
        imageStorageId: step.imageStorageId,
      }))
      .filter((step) => step.title.length > 0 || step.detail);

    const content = {
      summary: args.summary?.trim() || undefined,
      ppe: trimList(args.ppe),
      hazards: trimList(args.hazards),
      steps,
      beforeUse: trimList(args.beforeUse),
      afterUse: trimList(args.afterUse),
      updatedBy: profile.userId,
      updatedAt: now,
    };

    if (!existing) {
      return await ctx.db.insert("equipmentSops", {
        equipmentId: args.equipmentId,
        version: args.publish ? 1 : 0,
        ...content,
        isPublished: args.publish,
        publishedAt: args.publish ? now : undefined,
        createdAt: now,
      });
    }

    // Publishing bumps the version, which re-prompts every student to acknowledge.
    // Saving a draft, or re-saving an already-published SOP without publishing, does not.
    const shouldBumpVersion = args.publish;

    await ctx.db.patch(existing._id, {
      ...content,
      version: shouldBumpVersion ? existing.version + 1 : existing.version,
      isPublished: args.publish ? true : existing.isPublished,
      publishedAt: args.publish ? now : existing.publishedAt,
    });

    return existing._id;
  },
});

export const unpublishEquipmentSop = mutation({
  args: { equipmentId: v.id("equipment") },
  handler: async (ctx, args) => {
    await requireSopEditor(ctx);

    const sop = await getSop(ctx, args.equipmentId);

    if (!sop) {
      throw new Error("No SOP to unpublish.");
    }

    await ctx.db.patch(sop._id, { isPublished: false, updatedAt: Date.now() });
  },
});

export const generateSopImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireSopEditor(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const acknowledgeEquipmentSop = mutation({
  args: { equipmentId: v.id("equipment") },
  handler: async (ctx, args) => {
    const profile = await requireActiveProfile(ctx);

    const sop = await getSop(ctx, args.equipmentId);

    if (!sop || !sop.isPublished) {
      throw new Error("This tool does not have a published SOP yet.");
    }

    const existing = await ctx.db
      .query("equipmentSopAcknowledgements")
      .withIndex("by_user_equipment", (q) =>
        q.eq("userId", profile.userId).eq("equipmentId", args.equipmentId),
      )
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        sopVersion: sop.version,
        acknowledgedAt: now,
      });

      return existing._id;
    }

    return await ctx.db.insert("equipmentSopAcknowledgements", {
      equipmentId: args.equipmentId,
      userId: profile.userId,
      sopVersion: sop.version,
      acknowledgedAt: now,
    });
  },
});
