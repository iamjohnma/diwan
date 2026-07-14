import { defineApp } from "convex/server";
import { v } from "convex/values";

export default defineApp({
  env: {
    AUTH_GOOGLE_ID: v.optional(v.string()),
    AWS_SES_ACCESS_KEY_ID: v.optional(v.string()),
    AWS_SES_FROM_EMAIL: v.optional(v.string()),
    AWS_SES_REGION: v.optional(v.string()),
    AWS_SES_SECRET_ACCESS_KEY: v.optional(v.string()),
    GEMINI_API_KEY: v.optional(v.string()),
    GEMINI_CHAT_MODEL: v.optional(v.string()),
    GEMINI_LIVE_MODEL: v.optional(v.string()),
    GEMINI_LIVE_TOKEN_SESSION_TTL_MS: v.optional(v.string()),
    GEMINI_LIVE_TOKEN_NEW_SESSION_TTL_MS: v.optional(v.string()),
    GEMINI_LIVE_TOKEN_USES: v.optional(v.string()),
  },
});
