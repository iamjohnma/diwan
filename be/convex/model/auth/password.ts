import type { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import {
  createAccount,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
  signInViaProvider,
} from "@convex-dev/auth/server";
import type { Value } from "convex/values";
import { internal } from "../../_generated/api";
import type { DataModel, Doc } from "../../_generated/dataModel";
import { SesOtp } from "./sesOtp";

type AuthorizeCtx = Parameters<
  NonNullable<Parameters<typeof ConvexCredentials<DataModel>>[0]["authorize"]>
>[1];
type Params = Record<string, Value | undefined>;

function readString(params: Params, key: string): string | undefined {
  const value = params[key];
  if (typeof value !== "string") return undefined;
  return value.trim() || undefined;
}

function assertUserActive(user: Doc<"users">) {
  if (user.archivedAt !== undefined) throw new Error("ACCOUNT_DISABLED");
}

export function validatePassword(password: string) {
  if (password.length < 8) throw new Error("PASSWORD_TOO_SHORT");
  if (password.length > 128) throw new Error("PASSWORD_TOO_LONG");
  if (!/\d/.test(password)) throw new Error("PASSWORD_REQUIRES_NUMBER");
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new Error("PASSWORD_REQUIRES_SPECIAL_SYMBOL");
  }
}

function buildProfile(params: Params) {
  const email = readString(params, "email")?.toLowerCase();
  if (!email) throw new Error("EMAIL_REQUIRED");
  const firstName = readString(params, "firstName");
  const lastName = readString(params, "lastName");
  const name = [firstName, lastName].filter(Boolean).join(" ");
  return { email, ...(name ? { name } : {}) };
}

function isVerified(account: unknown, user: Doc<"users">) {
  const accountEmailVerified =
    typeof account === "object" &&
    account !== null &&
    "emailVerified" in account &&
    Boolean((account as { emailVerified?: unknown }).emailVerified);
  return accountEmailVerified || Boolean(user.emailVerificationTime);
}

const OTP_RESEND_COOLDOWN_MS = 45_000;

async function isSendCoolingDown(
  ctx: AuthorizeCtx,
  accountId: Doc<"authAccounts">["_id"],
) {
  const issuedAt: number | null = await ctx.runQuery(
    internal.internal.auth.getPendingVerificationCodeIssuedAt,
    { accountId },
  );
  return issuedAt !== null && Date.now() - issuedAt < OTP_RESEND_COOLDOWN_MS;
}

export async function authorizePassword(params: Params, ctx: AuthorizeCtx) {
  const flow = readString(params, "flow");
  const profile = buildProfile(params);
  if (!flow) throw new Error("INVALID_AUTH_FLOW");

  if (flow === "signUp") {
    const password = readString(params, "password");
    if (!password) throw new Error("PASSWORD_REQUIRED");
    validatePassword(password);
    await ctx.runMutation(
      internal.internal.auth.recycleUnverifiedPasswordSignup,
      { email: profile.email },
    );
    const created = await createAccount(ctx, {
      provider: "password",
      account: { id: profile.email, secret: password },
      profile,
      shouldLinkViaEmail: true,
      shouldLinkViaPhone: false,
    });
    if (!isVerified(created.account, created.user)) {
      return await signInViaProvider(ctx, SesOtp, {
        accountId: created.account._id,
        params,
      });
    }
    return { userId: created.user._id };
  }

  if (flow === "signIn") {
    const password = readString(params, "password");
    if (!password) throw new Error("PASSWORD_REQUIRED");
    let retrieved;
    try {
      retrieved = await retrieveAccount(ctx, {
        provider: "password",
        account: { id: profile.email, secret: password },
      });
    } catch {
      throw new Error("INVALID_CREDENTIALS");
    }
    if (!retrieved) throw new Error("INVALID_CREDENTIALS");
    assertUserActive(retrieved.user);
    if (!isVerified(retrieved.account, retrieved.user)) {
      return await signInViaProvider(ctx, SesOtp, {
        accountId: retrieved.account._id,
        params,
      });
    }
    return { userId: retrieved.user._id };
  }

  if (flow === "email-verification" || flow === "reset") {
    let retrieved;
    try {
      retrieved = await retrieveAccount(ctx, {
        provider: "password",
        account: { id: profile.email },
      });
    } catch {
      return null;
    }
    if (!retrieved) return null;
    assertUserActive(retrieved.user);
    if (await isSendCoolingDown(ctx, retrieved.account._id)) return null;
    return await signInViaProvider(ctx, SesOtp, {
      accountId: retrieved.account._id,
      params,
    });
  }

  if (flow === "reset-verification") {
    const newPassword = readString(params, "newPassword");
    if (!newPassword) throw new Error("NEW_PASSWORD_REQUIRED");
    validatePassword(newPassword);
    const retrieved = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: profile.email },
    });
    if (!retrieved) throw new Error("INVALID_VERIFICATION_CODE");
    assertUserActive(retrieved.user);
    const result = await signInViaProvider(ctx, SesOtp, { params });
    if (!result || result.userId !== retrieved.account.userId) {
      throw new Error("INVALID_VERIFICATION_CODE");
    }
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: profile.email, secret: newPassword },
    });
    await invalidateSessions(ctx, {
      userId: result.userId,
      except: [result.sessionId],
    });
    return result;
  }

  throw new Error("INVALID_AUTH_FLOW");
}
