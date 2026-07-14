import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { CASE_STATUSES } from "@diwan/shared";
import { firmMutation, firmQuery } from "./functions";
import { literalUnion } from "./lib/validators";
import { listCasesForAssistant } from "./model/aiAssistant/casesTool";

const caseStatusValidator = literalUnion(CASE_STATUSES);
const caseToolRowValidator = v.object({
  id: v.id("cases"),
  internalNumber: v.string(),
  courtNumber: v.optional(v.string()),
  courtName: v.optional(v.string()),
  caseType: v.string(),
  primaryLawyer: v.string(),
  claimAmount: v.optional(v.number()),
  status: caseStatusValidator,
  createdAt: v.number(),
});

export const createThread = firmMutation({
  args: { clientThreadKey: v.string() },
  returns: v.id("aiThreads"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("aiThreads")
      .withIndex("by_firm_user_client_thread_key", (q) =>
        q
          .eq("firmId", ctx.firmId)
          .eq("userId", ctx.userId)
          .eq("clientThreadKey", args.clientThreadKey),
      )
      .unique();
    if (existing) return existing._id;
    const now = Date.now();
    return await ctx.db.insert("aiThreads", {
      firmId: ctx.firmId,
      userId: ctx.userId,
      clientThreadKey: args.clientThreadKey,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listThreads = firmQuery({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("aiThreads"),
      title: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const threads = await ctx.db
      .query("aiThreads")
      .withIndex("by_firm_user", (q) =>
        q.eq("firmId", ctx.firmId).eq("userId", ctx.userId),
      )
      .order("desc")
      .take(30);
    return threads.map((thread) => ({
      id: thread._id,
      title: thread.title ?? "New conversation",
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    }));
  },
});

export const listMessages = firmQuery({
  args: {
    threadId: v.id("aiThreads"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.array(
    v.object({
      id: v.id("aiMessages"),
      role: literalUnion(["user", "assistant", "tool"] as const),
      content: v.string(),
      toolCalls: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get("aiThreads", args.threadId);
    if (
      !thread ||
      thread.firmId !== ctx.firmId ||
      thread.userId !== ctx.userId
    ) {
      return [];
    }
    const requested = Math.max(1, Math.min(200, args.paginationOpts.numItems));
    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(requested);
    return messages.reverse().map((message) => ({
      id: message._id,
      role: message.role,
      content: message.content,
      toolCalls: message.toolCalls,
      createdAt: message.createdAt,
    }));
  },
});

export const listCasesTool = firmQuery({
  args: {
    search: v.optional(v.string()),
    status: v.optional(caseStatusValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(caseToolRowValidator),
  handler: async (ctx, args) =>
    await listCasesForAssistant(ctx, ctx, {
      search: args.search,
      status: args.status,
      limit: args.limit,
    }),
});
