import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

export const getPendingVerificationCodeIssuedAt = internalQuery({
  args: { accountId: v.id("authAccounts") },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, args) => {
    const code = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", args.accountId))
      .unique();
    return code?._creationTime ?? null;
  },
});

export const recycleUnverifiedPasswordSignup = internalMutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .unique();
    if (!account) return null;

    const user = await ctx.db.get(account.userId);
    if (account.emailVerified || user?.emailVerificationTime) {
      throw new Error("ACCOUNT_ALREADY_EXISTS");
    }
    const code = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .unique();
    if (code) await ctx.db.delete(code._id);
    await ctx.db.delete(account._id);
    if (!user) return null;

    const otherAccount = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
      .first();
    const session = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .first();
    const membership = await ctx.db
      .query("firmMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!otherAccount && !session && !membership) await ctx.db.delete(user._id);
    return null;
  },
});
