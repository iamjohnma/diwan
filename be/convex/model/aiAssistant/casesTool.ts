import {
  CASE_STATUSES,
  type CaseStatus,
  PERMISSIONS,
  type PermissionString,
  RBAC,
} from "@diwan/shared";
import type { Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { AppError, ERROR_CODES } from "../../lib/errors";

export interface ListCasesToolArgs {
  search?: string;
  status?: CaseStatus;
  limit?: number;
}

type ReadCtx = Pick<QueryCtx, "db">;

export async function listCasesForAssistant(
  ctx: ReadCtx,
  facts: {
    firmId: Id<"firms">;
    userId: Id<"users">;
    permissions: ReadonlySet<PermissionString>;
  },
  args: ListCasesToolArgs,
) {
  const canReadAll =
    facts.permissions.has(RBAC.OWNER_WILDCARD as PermissionString) ||
    facts.permissions.has(PERMISSIONS.CASES_READ_ALL);
  const canReadOwn = facts.permissions.has(PERMISSIONS.CASES_READ_OWN);
  if (!canReadAll && !canReadOwn) {
    throw new AppError(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  const requestedLimit = Math.max(
    1,
    Math.min(50, Math.floor(args.limit ?? 20)),
  );
  const search = args.search?.trim().toLocaleLowerCase() ?? "";
  const readLimit = search ? 200 : requestedLimit;
  const status = args.status;
  if (status !== undefined && !CASE_STATUSES.includes(status)) {
    throw new AppError(ERROR_CODES.INVALID_STATUS_TRANSITION);
  }

  const candidates = canReadAll
    ? status === undefined
      ? await ctx.db
          .query("cases")
          .withIndex("by_firm_deleted_created", (q) =>
            q.eq("firmId", facts.firmId).eq("deletedAt", undefined),
          )
          .order("desc")
          .take(readLimit)
      : await ctx.db
          .query("cases")
          .withIndex("by_firm_status_and_deleted_and_created", (q) =>
            q
              .eq("firmId", facts.firmId)
              .eq("status", status)
              .eq("deletedAt", undefined),
          )
          .order("desc")
          .take(readLimit)
    : status === undefined
      ? await ctx.db
          .query("cases")
          .withIndex("by_firm_lawyer_deleted_created", (q) =>
            q
              .eq("firmId", facts.firmId)
              .eq("primaryLawyerId", facts.userId)
              .eq("deletedAt", undefined),
          )
          .order("desc")
          .take(readLimit)
      : await ctx.db
          .query("cases")
          .withIndex("by_firm_lawyer_and_status_and_deleted_and_created", (q) =>
            q
              .eq("firmId", facts.firmId)
              .eq("primaryLawyerId", facts.userId)
              .eq("status", status)
              .eq("deletedAt", undefined),
          )
          .order("desc")
          .take(readLimit);

  const matches = search
    ? candidates.filter((caseDoc) =>
        [caseDoc.internalNumber, caseDoc.courtNumber, caseDoc.courtName]
          .filter((value): value is string => typeof value === "string")
          .some((value) => value.toLocaleLowerCase().includes(search)),
      )
    : candidates;

  return await Promise.all(
    matches.slice(0, requestedLimit).map(async (caseDoc) => {
      const [caseType, lawyer] = await Promise.all([
        ctx.db.get("caseTypes", caseDoc.caseTypeId),
        ctx.db.get("users", caseDoc.primaryLawyerId),
      ]);
      return {
        id: caseDoc._id,
        internalNumber: caseDoc.internalNumber,
        courtNumber: caseDoc.courtNumber,
        courtName: caseDoc.courtName,
        caseType: caseType?.label ?? "",
        primaryLawyer: lawyer?.name ?? lawyer?.email ?? "",
        claimAmount: caseDoc.claimAmount,
        status: caseDoc.status,
        createdAt: caseDoc.createdAt,
      };
    }),
  );
}
