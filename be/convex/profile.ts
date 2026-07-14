import { v } from "convex/values";
import { firmMutation, firmQuery } from "./functions.ts";

const profileValidator = v.object({
  id: v.id("users"),
  createdAt: v.number(),
  name: v.string(),
  email: v.string(),
  image: v.union(v.string(), v.null()),
  role: v.string(),
});

export const current = firmQuery({
  args: {},
  returns: profileValidator,
  handler: async (ctx) => ({
    id: ctx.currentUser._id,
    createdAt: ctx.currentUser._creationTime,
    name: ctx.currentUser.name ?? "",
    email: ctx.currentUser.email ?? "",
    image: ctx.currentUser.image ?? null,
    role: ctx.roleName,
  }),
});

export const updateName = firmMutation({
  args: { name: v.string() },
  returns: profileValidator,
  handler: async (ctx, args) => {
    const name = args.name.replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 80) {
      throw new Error("INVALID_PROFILE_NAME");
    }

    await ctx.db.patch("users", ctx.userId, { name });

    return {
      id: ctx.currentUser._id,
      createdAt: ctx.currentUser._creationTime,
      name,
      email: ctx.currentUser.email ?? "",
      image: ctx.currentUser.image ?? null,
      role: ctx.roleName,
    };
  },
});
