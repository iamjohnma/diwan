import { v } from "convex/values";
import { RBAC, PERMISSIONS, type PermissionString } from "@diwan/shared";
import { firmQuery } from "./functions.ts";
import type { Doc } from "./_generated/dataModel";
import { literalUnion } from "./lib/validators.ts";
import { normalizeSearchText } from "./lib/search/normalizeSearchText.ts";

const PALETTE_SCOPES = ["all", "cases", "parties", "documents"] as const;
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

const caseResultValidator = v.object({
  id: v.id("cases"),
  internalNumber: v.string(),
  courtNumber: v.optional(v.string()),
  courtName: v.optional(v.string()),
  status: v.string(),
});

const partyResultValidator = v.object({
  id: v.id("parties"),
  nationalId: v.string(),
  fullName: v.string(),
  phone: v.optional(v.string()),
});

const documentResultValidator = v.object({
  id: v.id("documents"),
  caseId: v.id("cases"),
  title: v.string(),
  kind: v.string(),
});

function hasPermission(
  permissions: ReadonlySet<PermissionString>,
  permission: PermissionString,
): boolean {
  return (
    permissions.has(RBAC.OWNER_WILDCARD as PermissionString) ||
    permissions.has(permission)
  );
}

function includesScope(
  scope: (typeof PALETTE_SCOPES)[number],
  entity: Exclude<(typeof PALETTE_SCOPES)[number], "all">,
): boolean {
  return scope === "all" || scope === entity;
}

export const search = firmQuery({
  args: {
    queryText: v.string(),
    scope: v.optional(literalUnion(PALETTE_SCOPES)),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    cases: v.array(caseResultValidator),
    parties: v.array(partyResultValidator),
    documents: v.array(documentResultValidator),
  }),
  handler: async (ctx, args) => {
    const scope = args.scope ?? "all";
    const limit = Math.max(
      1,
      Math.min(MAX_LIMIT, Math.floor(args.limit ?? DEFAULT_LIMIT)),
    );
    const queryText = normalizeSearchText(args.queryText);
    const canReadAllCases = hasPermission(
      ctx.permissions,
      PERMISSIONS.CASES_READ_ALL,
    );
    const canReadOwnCases = hasPermission(
      ctx.permissions,
      PERMISSIONS.CASES_READ_OWN,
    );

    let caseRows: Doc<"cases">[] = [];
    if (includesScope(scope, "cases") && (canReadAllCases || canReadOwnCases)) {
      if (queryText.length > 0) {
        caseRows = canReadAllCases
          ? await ctx.db
              .query("cases")
              .withSearchIndex("search_text", (q) =>
                q
                  .search("searchText", queryText)
                  .eq("firmId", ctx.firmId)
                  .eq("deletedAt", undefined),
              )
              .take(limit)
          : await ctx.db
              .query("cases")
              .withSearchIndex("search_text", (q) =>
                q
                  .search("searchText", queryText)
                  .eq("firmId", ctx.firmId)
                  .eq("primaryLawyerId", ctx.userId)
                  .eq("deletedAt", undefined),
              )
              .take(limit);
      } else {
        caseRows = canReadAllCases
          ? await ctx.db
              .query("cases")
              .withIndex("by_firm_deleted_created", (q) =>
                q.eq("firmId", ctx.firmId).eq("deletedAt", undefined),
              )
              .order("desc")
              .take(limit)
          : await ctx.db
              .query("cases")
              .withIndex("by_firm_lawyer_deleted_created", (q) =>
                q
                  .eq("firmId", ctx.firmId)
                  .eq("primaryLawyerId", ctx.userId)
                  .eq("deletedAt", undefined),
              )
              .order("desc")
              .take(limit);
      }
    }

    let partyRows: Doc<"parties">[] = [];
    if (
      includesScope(scope, "parties") &&
      hasPermission(ctx.permissions, PERMISSIONS.PARTIES_READ)
    ) {
      partyRows =
        queryText.length > 0
          ? await ctx.db
              .query("parties")
              .withSearchIndex("search_text", (q) =>
                q
                  .search("searchText", queryText)
                  .eq("firmId", ctx.firmId)
                  .eq("deletedAt", undefined),
              )
              .take(limit)
          : await ctx.db
              .query("parties")
              .withIndex("by_firm_deleted_created", (q) =>
                q.eq("firmId", ctx.firmId).eq("deletedAt", undefined),
              )
              .order("desc")
              .take(limit);
    }

    let documentRows: Doc<"documents">[] = [];
    if (
      includesScope(scope, "documents") &&
      hasPermission(ctx.permissions, PERMISSIONS.DOCUMENTS_READ)
    ) {
      const candidates =
        queryText.length > 0
          ? await ctx.db
              .query("documents")
              .withSearchIndex("search_text", (q) =>
                q
                  .search("searchText", queryText)
                  .eq("firmId", ctx.firmId)
                  .eq("deletedAt", undefined),
              )
              .take(limit * 4)
          : await ctx.db
              .query("documents")
              .withIndex("by_firm_deleted_created", (q) =>
                q.eq("firmId", ctx.firmId).eq("deletedAt", undefined),
              )
              .order("desc")
              .take(limit * 4);

      for (const document of candidates) {
        if (documentRows.length >= limit) break;
        const caseDoc = await ctx.db.get("cases", document.caseId);
        if (
          !caseDoc ||
          caseDoc.firmId !== ctx.firmId ||
          caseDoc.deletedAt !== undefined
        )
          continue;
        if (
          canReadAllCases ||
          (canReadOwnCases && caseDoc.primaryLawyerId === ctx.userId)
        ) {
          documentRows.push(document);
        }
      }
    }

    return {
      cases: caseRows.map((row) => ({
        id: row._id,
        internalNumber: row.internalNumber,
        courtNumber: row.courtNumber,
        courtName: row.courtName,
        status: row.status,
      })),
      parties: partyRows.map((row) => ({
        id: row._id,
        nationalId: row.nationalId,
        fullName: row.fullName,
        phone: row.phone,
      })),
      documents: documentRows.map((row) => ({
        id: row._id,
        caseId: row.caseId,
        title: row.title,
        kind: row.kind,
      })),
    };
  },
});
