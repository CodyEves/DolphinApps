import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { canApproveOrders, requireProfile, requireSeasonAccess } from "./lib/authz";
import { orderStatusValidator } from "./lib/validators";

export const list = query({
  args: {
    seasonId: v.id("seasons"),
    status: v.optional(orderStatusValidator),
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    await requireSeasonAccess(ctx, profile, args.seasonId);

    if (args.status) {
      const status = args.status;
      return await ctx.db
        .query("orderRequests")
        .withIndex("by_seasonId_and_status", (q) =>
          q.eq("seasonId", args.seasonId).eq("status", status),
        )
        .order("desc")
        .take(200);
    }

    return await ctx.db
      .query("orderRequests")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .order("desc")
      .take(200);
  },
});

export const submit = mutation({
  args: {
    seasonId: v.id("seasons"),
    subsystemId: v.union(v.id("subsystems"), v.null()),
    partId: v.union(v.id("parts"), v.null()),
    itemName: v.string(),
    vendor: v.string(),
    url: v.string(),
    quantity: v.number(),
    estimatedCost: v.union(v.number(), v.null()),
    reason: v.string(),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    await requireSeasonAccess(ctx, profile, args.seasonId);

    if (args.subsystemId) {
      const subsystem = await ctx.db.get(args.subsystemId);

      if (!subsystem || subsystem.seasonId !== args.seasonId) {
        throw new Error("Choose a subsystem in the active season.");
      }
    }

    if (args.partId) {
      const part = await ctx.db.get(args.partId);

      if (!part || part.seasonId !== args.seasonId) {
        throw new Error("Choose a part from the same robot program season.");
      }
    }

    const now = Date.now();

    return await ctx.db.insert("orderRequests", {
      ...args,
      itemName: args.itemName.trim(),
      status: "requested",
      requestedByProfileId: profile._id,
      approvedByProfileId: null,
      orderedByProfileId: null,
      requestedAt: now,
      approvedAt: null,
      orderedAt: null,
      deliveredAt: null,
    });
  },
});

export const updateStatus = mutation({
  args: {
    orderRequestId: v.id("orderRequests"),
    status: orderStatusValidator,
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);

    if (!canApproveOrders(profile)) {
      throw new Error("Only mentors and admins can advance order status.");
    }

    const order = await ctx.db.get(args.orderRequestId);

    if (!order) {
      throw new Error("Order request not found.");
    }

    await requireSeasonAccess(ctx, profile, order.seasonId);

    const now = Date.now();

    await ctx.db.patch(args.orderRequestId, {
      status: args.status,
      notes: args.notes,
      approvedByProfileId:
        args.status === "approved" ? profile._id : order.approvedByProfileId,
      orderedByProfileId:
        args.status === "ordered" ? profile._id : order.orderedByProfileId,
      approvedAt: args.status === "approved" ? now : order.approvedAt,
      orderedAt: args.status === "ordered" ? now : order.orderedAt,
      deliveredAt: args.status === "delivered" ? now : order.deliveredAt,
    });

    return null;
  },
});
