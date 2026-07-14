import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import {
  CASE_STATUSES,
  type CaseStatus,
  PERMISSIONS,
  type PermissionString,
  RBAC,
} from "@diwan/shared";
import { firmMutation, firmQuery, requireFirmPermission } from "./functions.ts";
import { boundedPagination } from "./lib/pagination.ts";
import { normalizeSearchText } from "./lib/search/normalizeSearchText.ts";
import { literalUnion } from "./lib/validators.ts";
import { recordAuditEvent } from "./model/audit/recordAuditEvent.ts";
import {
  requireAccessibleCase,
  requireLawyerScopedAccess,
} from "./model/authz/owned.ts";
import { requireCaseType } from "./model/caseTypes/caseTypes.ts";
import {
  createCase,
  listCasesForCaller,
  requireCanAssignLawyer,
  requireLawyerIsFirmMember,
  softDeleteCase,
  updateCaseStatus,
} from "./model/cases/cases.ts";

const statusValidator = literalUnion(CASE_STATUSES);

const statusCountsValidator = v.object({
  intake: v.number(),
  filed: v.number(),
  in_hearings: v.number(),
  verdict: v.number(),
  execution: v.number(),
  closed: v.number(),
  archived: v.number(),
});

const caseDetailValidator = v.object({
  _id: v.id("cases"),
  internalNumber: v.string(),
  courtNumber: v.optional(v.string()),
  courtName: v.optional(v.string()),
  caseTypeId: v.id("caseTypes"),
  claimAmount: v.optional(v.number()),
  primaryLawyerId: v.id("users"),
  status: statusValidator,
});

const caseTableRowValidator = v.object({
  _id: v.id("cases"),
  internalNumber: v.string(),
  courtNumber: v.optional(v.string()),
  courtName: v.optional(v.string()),
  caseTypeId: v.id("caseTypes"),
  caseTypeName: v.string(),
  claimAmount: v.optional(v.number()),
  primaryLawyerId: v.id("users"),
  primaryLawyerName: v.string(),
  status: statusValidator,
  createdAt: v.number(),
});

const CASE_TABLE_FIELDS = [
  "internalNumber",
  "courtNumber",
  "courtName",
  "caseTypeName",
  "primaryLawyerName",
  "claimAmount",
  "status",
  "createdAt",
] as const;
const caseTableSortFieldValidator = literalUnion(CASE_TABLE_FIELDS);
const caseTableSortDirectionValidator = literalUnion(["asc", "desc"] as const);
type CaseTableField = (typeof CASE_TABLE_FIELDS)[number];
type FilterOperator =
  | "contains"
  | "notContains"
  | "equals"
  | "notEquals"
  | "startsWith"
  | "endsWith"
  | "isEmpty"
  | "isNotEmpty"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "isTrue"
  | "isFalse"
  | "is"
  | "isNot"
  | "isAnyOf"
  | "isNoneOf";
interface ParsedFilterRule {
  type: "rule";
  field: CaseTableField;
  operator: FilterOperator;
  value: string | number | boolean | string[];
}
interface ParsedFilterGroup {
  type: "group";
  connector: "and" | "or";
  items: (ParsedFilterRule | ParsedFilterGroup)[];
}
type CaseTableRow = {
  _id: import("./_generated/dataModel").Id<"cases">;
  internalNumber: string;
  courtNumber?: string;
  courtName?: string;
  caseTypeId: import("./_generated/dataModel").Id<"caseTypes">;
  caseTypeName: string;
  claimAmount?: number;
  primaryLawyerId: import("./_generated/dataModel").Id<"users">;
  primaryLawyerName: string;
  status: CaseStatus;
  createdAt: number;
};

const FILTER_OPERATORS = new Set<FilterOperator>([
  "contains",
  "notContains",
  "equals",
  "notEquals",
  "startsWith",
  "endsWith",
  "isEmpty",
  "isNotEmpty",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
  "isTrue",
  "isFalse",
  "is",
  "isNot",
  "isAnyOf",
  "isNoneOf",
]);
const CASE_TABLE_FIELD_SET = new Set<string>(CASE_TABLE_FIELDS);

function parseFilterItem(
  value: unknown,
  depth = 0,
): ParsedFilterRule | ParsedFilterGroup | null {
  if (value === null || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (item.type === "rule") {
    if (
      typeof item.field !== "string" ||
      !CASE_TABLE_FIELD_SET.has(item.field) ||
      typeof item.operator !== "string" ||
      !FILTER_OPERATORS.has(item.operator as FilterOperator)
    ) {
      return null;
    }
    const filterValue = item.value;
    if (
      typeof filterValue !== "string" &&
      typeof filterValue !== "number" &&
      typeof filterValue !== "boolean" &&
      !(
        Array.isArray(filterValue) &&
        filterValue.every((entry) => typeof entry === "string")
      )
    ) {
      return null;
    }
    return {
      type: "rule",
      field: item.field as CaseTableField,
      operator: item.operator as FilterOperator,
      value: filterValue,
    };
  }
  if (
    depth > 2 ||
    item.type !== "group" ||
    (item.connector !== "and" && item.connector !== "or") ||
    !Array.isArray(item.items) ||
    item.items.length > 25
  ) {
    return null;
  }
  const items = item.items.map((child) => parseFilterItem(child, depth + 1));
  if (items.some((child) => child === null)) return null;
  return {
    type: "group",
    connector: item.connector,
    items: items as (ParsedFilterRule | ParsedFilterGroup)[],
  };
}

function parseSerializedFilter(
  value: string | undefined,
): ParsedFilterGroup | null {
  if (!value || value.length > 20_000) return null;
  try {
    const parsed = parseFilterItem(JSON.parse(value));
    return parsed?.type === "group" ? parsed : null;
  } catch {
    return null;
  }
}

function isEmptyFilterValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function normalizeCaseTableText(value: unknown): string {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalizeSearchText(raw) || raw;
}

function compareFilterValues(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number")
    return left - right;
  return normalizeCaseTableText(left).localeCompare(
    normalizeCaseTableText(right),
  );
}

function matchesFilterRule(row: CaseTableRow, rule: ParsedFilterRule): boolean {
  const rawCell = row[rule.field];
  const cell =
    rule.field === "createdAt" && typeof rawCell === "number"
      ? new Date(rawCell).toISOString().slice(0, 10)
      : rawCell;
  if (rule.operator === "isEmpty") return isEmptyFilterValue(cell);
  if (rule.operator === "isNotEmpty") return !isEmptyFilterValue(cell);
  if (rule.operator === "isTrue") return Boolean(cell);
  if (rule.operator === "isFalse") return !Boolean(cell);
  if (rule.operator === "isAnyOf" || rule.operator === "isNoneOf") {
    const values = Array.isArray(rule.value)
      ? rule.value
      : [String(rule.value)];
    const matches = values.includes(String(cell ?? ""));
    return rule.operator === "isAnyOf" ? matches : !matches;
  }
  if (rule.operator === "is" || rule.operator === "isNot") {
    const matches = String(cell ?? "") === String(rule.value);
    return rule.operator === "is" ? matches : !matches;
  }
  const normalizedCell = normalizeCaseTableText(cell);
  const normalizedRule = normalizeCaseTableText(rule.value);
  if (rule.operator === "contains")
    return normalizedCell.includes(normalizedRule);
  if (rule.operator === "notContains")
    return !normalizedCell.includes(normalizedRule);
  if (rule.operator === "startsWith")
    return normalizedCell.startsWith(normalizedRule);
  if (rule.operator === "endsWith")
    return normalizedCell.endsWith(normalizedRule);
  const comparison = compareFilterValues(cell, rule.value);
  if (rule.operator === "equals") return comparison === 0;
  if (rule.operator === "notEquals") return comparison !== 0;
  if (rule.operator === "greaterThan") return comparison > 0;
  if (rule.operator === "greaterThanOrEqual") return comparison >= 0;
  if (rule.operator === "lessThan") return comparison < 0;
  return comparison <= 0;
}

function matchesFilterGroup(
  row: CaseTableRow,
  group: ParsedFilterGroup,
): boolean {
  const matches = (item: ParsedFilterRule | ParsedFilterGroup) =>
    item.type === "rule"
      ? matchesFilterRule(row, item)
      : matchesFilterGroup(row, item);
  return group.connector === "and"
    ? group.items.every(matches)
    : group.items.some(matches);
}

function matchesCaseTableSearch(row: CaseTableRow, query: string): boolean {
  const normalizedQuery = normalizeCaseTableText(query);
  return CASE_TABLE_FIELDS.some((field) =>
    normalizeCaseTableText(row[field]).includes(normalizedQuery),
  );
}

function toDetail(caseDoc: {
  _id: import("./_generated/dataModel").Id<"cases">;
  internalNumber: string;
  courtNumber?: string;
  courtName?: string;
  caseTypeId: import("./_generated/dataModel").Id<"caseTypes">;
  claimAmount?: number;
  primaryLawyerId: import("./_generated/dataModel").Id<"users">;
  status: (typeof CASE_STATUSES)[number];
}) {
  return {
    _id: caseDoc._id,
    internalNumber: caseDoc.internalNumber,
    courtNumber: caseDoc.courtNumber,
    courtName: caseDoc.courtName,
    caseTypeId: caseDoc.caseTypeId,
    claimAmount: caseDoc.claimAmount,
    primaryLawyerId: caseDoc.primaryLawyerId,
    status: caseDoc.status,
  };
}

export const create = firmMutation({
  args: {
    internalNumber: v.string(),
    courtNumber: v.optional(v.string()),
    courtName: v.optional(v.string()),
    caseTypeId: v.id("caseTypes"),
    claimAmount: v.optional(v.number()),
    primaryLawyerId: v.id("users"),
  },
  returns: v.id("cases"),
  handler: async (ctx, args) => {
    requireCanAssignLawyer(ctx, args.primaryLawyerId);
    await requireLawyerIsFirmMember(ctx, ctx.firmId, args.primaryLawyerId);
    await requireCaseType(ctx, ctx.firmId, args.caseTypeId);
    // Every new case starts at 'intake' — the actual start of the lifecycle
    // (IMPLEMENTATION_PLAN.md's status sequence). Callers cannot supply an
    // initial status, which would otherwise bypass the CASES_CLOSE gate and
    // the linear transition-graph validation in updateStatus. createCase
    // itself hardcodes 'intake', so there's no public seam for a caller to
    // pass something else by mistake.
    const caseId = await createCase(ctx, ctx.firmId, args);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: "cases",
      entityId: caseId,
      action: "create",
      after: args,
    });
    return caseId;
  },
});

export const get = firmQuery({
  args: { caseId: v.id("cases") },
  returns: caseDetailValidator,
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    return toDetail(caseDoc);
  },
});

export const updateStatus = firmMutation({
  args: { caseId: v.id("cases"), status: statusValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    const requiredPermission =
      args.status === "closed" ? PERMISSIONS.CASES_CLOSE : undefined;
    requireLawyerScopedAccess(
      ctx,
      caseDoc.primaryLawyerId,
      requiredPermission ?? PERMISSIONS.CASES_WRITE_OWN,
      requiredPermission ?? PERMISSIONS.CASES_WRITE_ALL,
    );
    const before = toDetail(caseDoc);
    await updateCaseStatus(ctx, caseDoc, args.status);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: "cases",
      entityId: caseDoc._id,
      action: "updateStatus",
      before,
      after: { status: args.status },
    });
    return null;
  },
});

export const remove = firmMutation({
  args: { caseId: v.id("cases") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireLawyerScopedAccess(
      ctx,
      caseDoc.primaryLawyerId,
      PERMISSIONS.CASES_DELETE,
      PERMISSIONS.CASES_DELETE,
    );
    await softDeleteCase(ctx, caseDoc);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: "cases",
      entityId: caseDoc._id,
      action: "delete",
    });
    return null;
  },
});

export const list = firmQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(caseDetailValidator),
  handler: async (ctx, args) => {
    const result = await listCasesForCaller(
      ctx,
      ctx.firmId,
      args.paginationOpts,
    );
    return { ...result, page: result.page.map(toDetail) };
  },
});

/**
 * Page-number endpoint for the Naab-style cases table. Convex cursors remain
 * the right primitive for unbounded feeds; this numbered table deliberately
 * caps random-access reads at 1,000 rows so page buttons stay deterministic
 * without introducing an unbounded scan.
 */
export const listTablePage = firmQuery({
  args: {
    status: v.optional(statusValidator),
    searchText: v.optional(v.string()),
    serializedFilter: v.optional(v.string()),
    sortField: v.optional(caseTableSortFieldValidator),
    sortDirection: v.optional(caseTableSortDirectionValidator),
    page: v.number(),
    pageSize: v.number(),
  },
  returns: v.object({
    rows: v.array(caseTableRowValidator),
    totalRows: v.number(),
    page: v.number(),
    pageSize: v.number(),
    statusCounts: statusCountsValidator,
  }),
  handler: async (ctx, args) => {
    const pageSize = Math.min(100, Math.max(1, Math.floor(args.pageSize)));
    const page = Math.min(100, Math.max(1, Math.floor(args.page)));
    const rowsToRead = Math.min(1_000, page * pageSize);
    const rawSearch = args.searchText?.trim() ?? '';
    const parsedFilter = parseSerializedFilter(args.serializedFilter);
    const sortField = args.sortField ?? 'createdAt';
    const sortDirection = args.sortDirection ?? 'desc';
    const requiresMaterialization =
      rawSearch.length > 0 ||
      parsedFilter !== null ||
      sortField !== 'createdAt';
    const rowsToReadLimit = requiresMaterialization ? 1_000 : rowsToRead;
    const canReadAll =
      ctx.permissions.has(RBAC.OWNER_WILDCARD as PermissionString) ||
      ctx.permissions.has(PERMISSIONS.CASES_READ_ALL);
    const canReadOwn = ctx.permissions.has(PERMISSIONS.CASES_READ_OWN);

    if (!canReadAll && !canReadOwn) {
      requireFirmPermission(ctx, PERMISSIONS.CASES_READ_ALL);
    }

    const pageCandidates = canReadAll
      ? args.status === undefined
        ? await ctx.db
            .query('cases')
            .withIndex('by_firm_deleted_created', (q) =>
              q.eq('firmId', ctx.firmId).eq('deletedAt', undefined)
            )
            .order(sortDirection)
            .take(rowsToReadLimit)
        : await ctx.db
            .query('cases')
            .withIndex('by_firm_status_and_deleted_and_created', (q) =>
              q
                .eq('firmId', ctx.firmId)
                .eq('status', args.status as CaseStatus)
                .eq('deletedAt', undefined)
            )
            .order(sortDirection)
            .take(rowsToReadLimit)
      : args.status === undefined
        ? await ctx.db
            .query('cases')
            .withIndex('by_firm_lawyer_deleted_created', (q) =>
              q
                .eq('firmId', ctx.firmId)
                .eq('primaryLawyerId', ctx.userId)
                .eq('deletedAt', undefined)
            )
            .order(sortDirection)
            .take(rowsToReadLimit)
        : await ctx.db
            .query('cases')
            .withIndex(
              'by_firm_lawyer_and_status_and_deleted_and_created',
              (q) =>
                q
                  .eq('firmId', ctx.firmId)
                  .eq('primaryLawyerId', ctx.userId)
                  .eq('status', args.status as CaseStatus)
                  .eq('deletedAt', undefined)
            )
            .order(sortDirection)
            .take(rowsToReadLimit);
    const start = (page - 1) * pageSize;
    const candidatesToEnrich = requiresMaterialization
      ? pageCandidates
      : pageCandidates.slice(start, start + pageSize);
    const enrichedRows: CaseTableRow[] = await Promise.all(
      candidatesToEnrich.map(async (caseDoc) => {
        const [caseType, primaryLawyer] = await Promise.all([
          ctx.db.get('caseTypes', caseDoc.caseTypeId),
          ctx.db.get('users', caseDoc.primaryLawyerId)
        ]);
        return {
          _id: caseDoc._id,
          internalNumber: caseDoc.internalNumber,
          courtNumber: caseDoc.courtNumber,
          courtName: caseDoc.courtName,
          caseTypeId: caseDoc.caseTypeId,
          caseTypeName: caseType?.label ?? '',
          claimAmount: caseDoc.claimAmount,
          primaryLawyerId: caseDoc.primaryLawyerId,
          primaryLawyerName: primaryLawyer?.name ?? primaryLawyer?.email ?? '',
          status: caseDoc.status,
          createdAt: caseDoc.createdAt
        };
      })
    );
    const matchedRows = enrichedRows.filter(
      (row) =>
        (rawSearch.length === 0 || matchesCaseTableSearch(row, rawSearch)) &&
        (parsedFilter === null || matchesFilterGroup(row, parsedFilter))
    );
    if (requiresMaterialization) {
      matchedRows.sort((left, right) => {
        const comparison = compareFilterValues(
          left[sortField],
          right[sortField]
        );
        if (comparison !== 0) {
          return sortDirection === 'asc' ? comparison : -comparison;
        }
        return right.createdAt - left.createdAt;
      });
    }
    const rows = requiresMaterialization
      ? matchedRows.slice(start, start + pageSize)
      : matchedRows;
    const metric = canReadAll
      ? await ctx.db
          .query('caseTableMetrics')
          .withIndex('by_firm_and_scope', (q) =>
            q.eq('firmId', ctx.firmId).eq('scope', 'firm')
          )
          .unique()
      : await ctx.db
          .query('caseTableMetrics')
          .withIndex('by_firm_and_scope_and_lawyer', (q) =>
            q
              .eq('firmId', ctx.firmId)
              .eq('scope', 'lawyer')
              .eq('primaryLawyerId', ctx.userId)
          )
          .unique();
    const statusCounts = metric?.statusCounts ?? {
      intake: 0,
      filed: 0,
      in_hearings: 0,
      verdict: 0,
      execution: 0,
      closed: 0,
      archived: 0
    };
    const totalRows = requiresMaterialization
      ? matchedRows.length
      : args.status === undefined
        ? (metric?.total ?? 0)
        : statusCounts[args.status as CaseStatus];

    return { rows, totalRows, page, pageSize, statusCounts };
  }
});

export const search = firmQuery({
  args: { queryText: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(caseDetailValidator),
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.CASES_READ_ALL);
    const normalized = normalizeSearchText(args.queryText);
    const result = await ctx.db
      .query("cases")
      .withSearchIndex("search_text", (q) =>
        q
          .search("searchText", normalized)
          .eq("firmId", ctx.firmId)
          .eq("deletedAt", undefined),
      )
      .paginate(boundedPagination(args.paginationOpts));
    return { ...result, page: result.page.map(toDetail) };
  },
});
