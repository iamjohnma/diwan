import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { AppError, ERROR_CODES } from "./lib/errors";
import { ensureRbacSeeded } from "./model/authz/rbacSeed";

export const status = query({
  args: {},
  returns: v.object({ ready: v.boolean() }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new AppError(ERROR_CODES.UNAUTHENTICATED);
    const membership = await ctx.db
      .query("firmMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return { ready: membership?.status === "active" };
  },
});

export const ensureInitialFirm = mutation({
  args: {},
  returns: v.object({ firmId: v.id("firms") }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new AppError(ERROR_CODES.UNAUTHENTICATED);
    const user = await ctx.db.get("users", userId);
    if (!user || user.archivedAt !== undefined) {
      throw new AppError(ERROR_CODES.UNAUTHENTICATED);
    }

    const existingMembership = await ctx.db
      .query("firmMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existingMembership) {
      if (user.activeFirmId !== existingMembership.firmId) {
        await ctx.db.patch("users", userId, {
          activeFirmId: existingMembership.firmId,
        });
      }
      return { firmId: existingMembership.firmId };
    }

    await ensureRbacSeeded(ctx);
    const ownerRole = await ctx.db
      .query("roles")
      .withIndex("by_name", (q) => q.eq("name", "owner"))
      .unique();
    if (!ownerRole) throw new AppError(ERROR_CODES.ROLE_NOT_FOUND);

    const now = Date.now();
    const displayName =
      user.name?.trim() || user.email?.split("@")[0] || "Diwan";
    const firmId = await ctx.db.insert("firms", {
      name: `${displayName}'s firm`,
      slug: `firm-${String(userId).slice(-12)}`,
      createdAt: now,
    });
    await ctx.db.insert("subscriptions", {
      firmId,
      plan: "standard",
      seatLimit: 10,
      status: "trial",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("firmMembers", {
      firmId,
      userId,
      roleId: ownerRole._id,
      status: "active",
      invitedAt: now,
      joinedAt: now,
    });
    await ctx.db.patch("users", userId, { activeFirmId: firmId });
    return { firmId };
  },
});
