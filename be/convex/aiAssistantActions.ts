"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import {
  type Content,
  type FunctionCall,
  GoogleGenAI,
  ThinkingLevel,
} from "@google/genai";
import { v } from "convex/values";
import { CASE_STATUSES, type CaseStatus } from "@diwan/shared";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, env } from "./_generated/server";
import { AppError, ERROR_CODES } from "./lib/errors";
import { createGeminiLiveClientToken } from "./model/geminiLive";

const DEFAULT_CHAT_MODEL = "gemini-3.5-flash";
const SYSTEM_INSTRUCTION = `You are Diwan's legal case-management assistant. Be concise, accurate, and helpful. You have exactly one application tool: list_cases. Use it whenever the user asks about cases or needs current case data. Never claim that you can create, edit, delete, or perform any other action. Reply in the user's language. Format case results clearly and do not expose internal IDs unless asked.`;

function requireGeminiKey(): string {
  const key = (env.GEMINI_API_KEY ?? "").trim();
  if (!key) throw new Error("GEMINI_API_KEY is not configured.");
  return key;
}

interface PreparedChat {
  firmId: Id<"firms">;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}

interface AssistantCaseRow {
  id: Id<"cases">;
  internalNumber: string;
  courtNumber?: string;
  courtName?: string;
  caseType: string;
  primaryLawyer: string;
  claimAmount?: number;
  status: CaseStatus;
  createdAt: number;
}

interface ChatResult {
  text: string;
  toolCall?: { name: string; args: unknown; resultCount: number };
}

function readToolArgs(call: FunctionCall): {
  search?: string;
  status?: CaseStatus;
  limit?: number;
} {
  const args = call.args && typeof call.args === "object" ? call.args : {};
  const record = args as Record<string, unknown>;
  const status =
    typeof record.status === "string" &&
    CASE_STATUSES.includes(record.status as CaseStatus)
      ? (record.status as CaseStatus)
      : undefined;
  return {
    search: typeof record.search === "string" ? record.search : undefined,
    status,
    limit: typeof record.limit === "number" ? record.limit : undefined,
  };
}

export const chat = action({
  args: { threadId: v.id("aiThreads"), prompt: v.string() },
  returns: v.object({
    text: v.string(),
    toolCall: v.optional(
      v.object({ name: v.string(), args: v.any(), resultCount: v.number() }),
    ),
  }),
  handler: async (ctx, args): Promise<ChatResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new AppError(ERROR_CODES.UNAUTHENTICATED);
    const prepared: PreparedChat = await ctx.runQuery(
      internal.internal.aiAssistant.prepareChat,
      {
        userId,
        threadId: args.threadId,
      },
    );
    const contents: Content[] = prepared.history.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
    contents.push({ role: "user", parts: [{ text: args.prompt }] });

    const ai = new GoogleGenAI({ apiKey: requireGeminiKey() });
    const model = env.GEMINI_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL;
    const config = {
      systemInstruction: SYSTEM_INSTRUCTION,
      // Gemini 2.5 models use a thinking budget rather than the Live API's
      // thinking-level enum. A value of -1 lets Gemini choose dynamically.
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      tools: [
        {
          functionDeclarations: [
            {
              name: "list_cases",
              description:
                "List the cases the signed-in user is allowed to read. Supports optional text search, lifecycle status, and result limit.",
              parametersJsonSchema: {
                type: "object",
                properties: {
                  search: {
                    type: "string",
                    description: "Case, court, or number search text.",
                  },
                  status: { type: "string", enum: [...CASE_STATUSES] },
                  limit: { type: "number", minimum: 1, maximum: 50 },
                },
              },
            },
          ],
        },
      ],
    };
    const first = await ai.models.generateContent({ model, contents, config });
    const call = first.functionCalls?.find(
      (candidate) => candidate.name === "list_cases",
    );
    let text = first.text?.trim() ?? "";
    let toolCall:
      { name: string; args: unknown; resultCount: number } | undefined;

    if (call) {
      const toolArgs = readToolArgs(call);
      const cases: AssistantCaseRow[] = await ctx.runQuery(
        internal.internal.aiAssistant.listCasesForTool,
        {
          userId,
          firmId: prepared.firmId,
          ...toolArgs,
        },
      );
      const modelContent = first.candidates?.[0]?.content;
      if (modelContent) contents.push(modelContent);
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              id: call.id,
              name: "list_cases",
              response: { cases },
            },
          },
        ],
      });
      const finalResponse = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      text = finalResponse.text?.trim() ?? "";
      toolCall = {
        name: "list_cases",
        args: toolArgs,
        resultCount: cases.length,
      };
    }
    if (!text) text = "I could not produce a response. Please try again.";
    await ctx.runMutation(internal.internal.aiAssistant.saveTurn, {
      userId,
      threadId: args.threadId,
      prompt: args.prompt,
      response: text,
      toolCalls: toolCall ? JSON.stringify(toolCall) : undefined,
    });
    return { text, toolCall };
  },
});

export const mintLiveToken = action({
  args: {},
  returns: v.object({
    token: v.string(),
    expiresAt: v.string(),
    newSessionExpiresAt: v.string(),
    model: v.string(),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new AppError(ERROR_CODES.UNAUTHENTICATED);
    await ctx.runQuery(internal.internal.aiAssistant.requireVoiceAccess, {
      userId,
    });
    return await createGeminiLiveClientToken({
      apiKey: requireGeminiKey(),
      model: env.GEMINI_LIVE_MODEL,
      sessionTtlMs: env.GEMINI_LIVE_TOKEN_SESSION_TTL_MS,
      newSessionTtlMs: env.GEMINI_LIVE_TOKEN_NEW_SESSION_TTL_MS,
      uses: env.GEMINI_LIVE_TOKEN_USES,
    });
  },
});
