import { v } from "convex/values";
import { CASE_STATUSES } from "@diwan/shared";
import { internalMutation, internalQuery } from "../_generated/server";
import { AppError, ERROR_CODES } from "../lib/errors";
import { literalUnion } from "../lib/validators";
import { listCasesForAssistant } from "../model/aiAssistant/casesTool";
import { loadMemberContext } from "../model/authz/memberContext";

const caseStatusValidator = literalUnion(CASE_STATUSES);

export const prepareChat = internalQuery({
  args: { userId: v.id("users"), threadId: v.id("aiThreads") },
  returns: v.object({
    firmId: v.id("firms"),
    history: v.array(
      v.object({
        role: literalUnion(["user", "assistant"] as const),
        content: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const [user, thread] = await Promise.all([
      ctx.db.get("users", args.userId),
      ctx.db.get("aiThreads", args.threadId),
    ]);
    if (
      !user ||
      user.archivedAt !== undefined ||
      !thread ||
      thread.userId !== args.userId
    ) {
      throw new AppError(ERROR_CODES.UNAUTHENTICATED);
    }
    const member = await loadMemberContext(ctx, args.userId, thread.firmId);
    if (!member) throw new AppError(ERROR_CODES.NOT_A_FIRM_MEMBER);
    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(24);
    return {
      firmId: thread.firmId,
      history: messages
        .reverse()
        .filter((message) => message.role !== "tool")
        .map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        })),
    };
  },
});

export const listCasesForTool = internalQuery({
  args: {
    userId: v.id("users"),
    firmId: v.id("firms"),
    search: v.optional(v.string()),
    status: v.optional(caseStatusValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const member = await loadMemberContext(ctx, args.userId, args.firmId);
    if (!member) throw new AppError(ERROR_CODES.NOT_A_FIRM_MEMBER);
    return await listCasesForAssistant(
      ctx,
      {
        firmId: args.firmId,
        userId: args.userId,
        permissions: member.permissions,
      },
      { search: args.search, status: args.status, limit: args.limit },
    );
  },
});

export const saveTurn = internalMutation({
  args: {
    userId: v.id("users"),
    threadId: v.id("aiThreads"),
    prompt: v.string(),
    response: v.string(),
    toolCalls: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get("aiThreads", args.threadId);
    if (!thread || thread.userId !== args.userId) {
      throw new AppError(ERROR_CODES.UNAUTHENTICATED);
    }
    const member = await loadMemberContext(ctx, args.userId, thread.firmId);
    if (!member) throw new AppError(ERROR_CODES.NOT_A_FIRM_MEMBER);
    const now = Date.now();
    await ctx.db.insert("aiMessages", {
      firmId: thread.firmId,
      threadId: thread._id,
      role: "user",
      content: args.prompt,
      createdAt: now,
    });
    await ctx.db.insert("aiMessages", {
      firmId: thread.firmId,
      threadId: thread._id,
      role: "assistant",
      content: args.response,
      toolCalls: args.toolCalls,
      createdAt: now + 1,
    });
    await ctx.db.patch("aiThreads", thread._id, {
      title: thread.title ?? args.prompt.trim().slice(0, 64),
      updatedAt: now + 1,
    });
    return null;
  },
});

export const requireVoiceAccess = internalQuery({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user || user.archivedAt !== undefined || !user.activeFirmId) {
      throw new AppError(ERROR_CODES.UNAUTHENTICATED);
    }
    const member = await loadMemberContext(ctx, args.userId, user.activeFirmId);
    if (!member) throw new AppError(ERROR_CODES.NOT_A_FIRM_MEMBER);
    return null;
  },
});
