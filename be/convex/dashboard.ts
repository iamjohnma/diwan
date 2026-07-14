import { v } from "convex/values";
import { PERMISSIONS, RBAC, type PermissionString } from "@diwan/shared";
import type { Doc, Id } from "./_generated/dataModel.ts";
import type { QueryCtx } from "./_generated/server.ts";
import { firmQuery } from "./functions.ts";
import { literalUnion } from "./lib/validators.ts";
import { getFeeBalance } from "./model/billing/aggregates.ts";

const PERIODS_COUNT = 12;
const MAX_FINANCIAL_ROWS = 1_000;
const MAX_TODAY_HEARINGS = 20;
const periodValidator = literalUnion(["weekly", "monthly"] as const);

type DashboardPeriod = "weekly" | "monthly";
type PeriodBucket = {
  periodStart: string;
  periodEnd: string;
  label: string;
  startMs: number;
  endMs: number;
};
type DashboardQueryCtx = Pick<QueryCtx, "db"> & {
  firmId: Id<"firms">;
  userId: Id<"users">;
  permissions: ReadonlySet<PermissionString>;
};

function hasPermission(
  permissions: ReadonlySet<PermissionString>,
  permission: PermissionString,
): boolean {
  return (
    permissions.has(RBAC.OWNER_WILDCARD as PermissionString) ||
    permissions.has(permission)
  );
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildPeriods(
  period: DashboardPeriod,
  referenceTimestamp: number,
): PeriodBucket[] {
  const now = new Date(referenceTimestamp);
  const periods: PeriodBucket[] = [];

  for (let index = PERIODS_COUNT - 1; index >= 0; index -= 1) {
    if (period === "weekly") {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay() - index * 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      periods.push({
        periodStart: formatDate(start),
        periodEnd: formatDate(end),
        label: start.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
        }),
        startMs: start.getTime(),
        endMs: end.getTime(),
      });
      continue;
    }

    const start = new Date(now.getFullYear(), now.getMonth() - index, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    periods.push({
      periodStart: formatDate(start),
      periodEnd: formatDate(end),
      label: start.toLocaleString("en-US", {
        month: "short",
        year: "numeric",
      }),
      startMs: start.getTime(),
      endMs: end.getTime(),
    });
  }

  return periods;
}

function isRecognizedFeePayment(entry: Doc<"ledgerEntries">): boolean {
  return (
    entry.accountType === "fee" &&
    entry.direction === "credit" &&
    entry.type === "payment" &&
    entry.amount > 0
  );
}

async function filterPaymentsForCaller(
  ctx: DashboardQueryCtx,
  entries: Doc<"ledgerEntries">[],
): Promise<Doc<"ledgerEntries">[]> {
  if (
    hasPermission(ctx.permissions, PERMISSIONS.PAYMENTS_READ_ALL) ||
    hasPermission(ctx.permissions, PERMISSIONS.PAYMENTS_WRITE_ALL)
  ) {
    return entries.filter(isRecognizedFeePayment);
  }
  if (
    !hasPermission(ctx.permissions, PERMISSIONS.PAYMENTS_READ_OWN) &&
    !hasPermission(ctx.permissions, PERMISSIONS.PAYMENTS_WRITE_OWN)
  ) {
    return [];
  }

  const accessibleEntries = await Promise.all(
    entries.map(async (entry) => {
      if (!isRecognizedFeePayment(entry)) return null;
      const caseDoc = await ctx.db.get(entry.caseId);
      return caseDoc?.primaryLawyerId === ctx.userId ? entry : null;
    }),
  );
  return accessibleEntries.filter(
    (entry): entry is Doc<"ledgerEntries"> => entry !== null,
  );
}

export const getKpiStats = firmQuery({
  args: {},
  returns: v.object({
    revenue: v.object({ total: v.number(), paymentsCount: v.number() }),
    outstandingBalance: v.number(),
    activeCases: v.object({ total: v.number(), intake: v.number() }),
  }),
  handler: async (ctx) => {
    const canReadAllCases = hasPermission(
      ctx.permissions,
      PERMISSIONS.CASES_READ_ALL,
    );
    const canReadOwnCases = hasPermission(
      ctx.permissions,
      PERMISSIONS.CASES_READ_OWN,
    );
    const metric = canReadAllCases
      ? await ctx.db
          .query("caseTableMetrics")
          .withIndex("by_firm_and_scope", (query) =>
            query.eq("firmId", ctx.firmId).eq("scope", "firm"),
          )
          .unique()
      : canReadOwnCases
        ? await ctx.db
            .query("caseTableMetrics")
            .withIndex("by_firm_and_scope_and_lawyer", (query) =>
              query
                .eq("firmId", ctx.firmId)
                .eq("scope", "lawyer")
                .eq("primaryLawyerId", ctx.userId),
            )
            .unique()
        : null;
    const activeCases = Math.max(
      0,
      (metric?.total ?? 0) -
        (metric?.statusCounts.closed ?? 0) -
        (metric?.statusCounts.archived ?? 0),
    );
    const canReadAllPayments =
      hasPermission(ctx.permissions, PERMISSIONS.PAYMENTS_READ_ALL) ||
      hasPermission(ctx.permissions, PERMISSIONS.PAYMENTS_WRITE_ALL);
    const canReadOwnPayments =
      hasPermission(ctx.permissions, PERMISSIONS.PAYMENTS_READ_OWN) ||
      hasPermission(ctx.permissions, PERMISSIONS.PAYMENTS_WRITE_OWN);
    const outstandingBalance = canReadAllPayments
      ? await getFeeBalance(ctx, ctx.firmId, "firm", undefined)
      : canReadOwnPayments
        ? await getFeeBalance(ctx, ctx.firmId, "lawyer", ctx.userId)
        : 0;
    const entries =
      canReadAllPayments || canReadOwnPayments
        ? await ctx.db
            .query("ledgerEntries")
            .withIndex("by_firm_created", (query) =>
              query.eq("firmId", ctx.firmId),
            )
            .order("desc")
            .take(MAX_FINANCIAL_ROWS)
        : [];
    const payments = await filterPaymentsForCaller(ctx, entries);

    return {
      revenue: {
        total: payments.reduce((total, entry) => total + entry.amount, 0),
        paymentsCount: payments.length,
      },
      outstandingBalance,
      activeCases: {
        total: activeCases,
        intake: metric?.statusCounts.intake ?? 0,
      },
    };
  },
});

export const getCashFlow = firmQuery({
  args: { period: periodValidator, referenceTimestamp: v.number() },
  returns: v.object({
    data: v.array(
      v.object({
        periodStart: v.string(),
        periodEnd: v.string(),
        label: v.string(),
        amount: v.number(),
      }),
    ),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    const periods = buildPeriods(args.period, args.referenceTimestamp);
    const rangeStart = periods[0]?.startMs ?? args.referenceTimestamp;
    const rangeEnd = periods.at(-1)?.endMs ?? args.referenceTimestamp;
    const canReadPayments =
      hasPermission(ctx.permissions, PERMISSIONS.PAYMENTS_READ_ALL) ||
      hasPermission(ctx.permissions, PERMISSIONS.PAYMENTS_WRITE_ALL) ||
      hasPermission(ctx.permissions, PERMISSIONS.PAYMENTS_READ_OWN) ||
      hasPermission(ctx.permissions, PERMISSIONS.PAYMENTS_WRITE_OWN);
    const entries = canReadPayments
      ? await ctx.db
          .query("ledgerEntries")
          .withIndex("by_firm_created", (query) =>
            query
              .eq("firmId", ctx.firmId)
              .gte("createdAt", rangeStart)
              .lte("createdAt", rangeEnd),
          )
          .take(MAX_FINANCIAL_ROWS)
      : [];
    const payments = await filterPaymentsForCaller(ctx, entries);
    const amounts = new Map<string, number>();

    for (const payment of payments) {
      const bucket = periods.find(
        (candidate) =>
          payment.createdAt >= candidate.startMs &&
          payment.createdAt <= candidate.endMs,
      );
      if (!bucket) continue;
      amounts.set(
        bucket.periodStart,
        (amounts.get(bucket.periodStart) ?? 0) + payment.amount,
      );
    }

    const data = periods.map((bucket) => ({
      periodStart: bucket.periodStart,
      periodEnd: bucket.periodEnd,
      label: bucket.label,
      amount: amounts.get(bucket.periodStart) ?? 0,
    }));
    return {
      data,
      total: data.reduce((total, bucket) => total + bucket.amount, 0),
    };
  },
});

export const getTodayHearings = firmQuery({
  args: {
    timezoneOffsetMinutes: v.number(),
    referenceTimestamp: v.number(),
    currentTimestamp: v.number(),
  },
  returns: v.array(
    v.object({
      id: v.id("hearings"),
      caseId: v.id("cases"),
      caseNumber: v.string(),
      date: v.number(),
      court: v.optional(v.string()),
      hall: v.optional(v.string()),
      lawyerName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    if (!hasPermission(ctx.permissions, PERMISSIONS.HEARINGS_READ)) return [];
    const offsetMs = args.timezoneOffsetMinutes * 60_000;
    const localReference = new Date(args.referenceTimestamp - offsetMs);
    localReference.setUTCHours(0, 0, 0, 0);
    const startMs = localReference.getTime() + offsetMs;
    const endMs = startMs + 24 * 60 * 60 * 1_000;
    const queryStart = Math.max(startMs, args.currentTimestamp);
    const canReadAllCases = hasPermission(
      ctx.permissions,
      PERMISSIONS.CASES_READ_ALL,
    );
    const hearings = await ctx.db
      .query("hearings")
      .withIndex("by_firm_deleted_date", (query) =>
        query
          .eq("firmId", ctx.firmId)
          .eq("deletedAt", undefined)
          .gte("date", queryStart)
          .lt("date", endMs),
      )
      .take(MAX_TODAY_HEARINGS);
    const rows = await Promise.all(
      hearings.map(async (hearing) => {
        if (!canReadAllCases && hearing.lawyerId !== ctx.userId) return null;
        const [caseDoc, lawyer] = await Promise.all([
          ctx.db.get(hearing.caseId),
          ctx.db.get(hearing.lawyerId),
        ]);
        if (!caseDoc || caseDoc.deletedAt !== undefined) return null;
        return {
          id: hearing._id,
          caseId: hearing.caseId,
          caseNumber: caseDoc.internalNumber,
          date: hearing.date,
          court: hearing.court,
          hall: hearing.hall,
          lawyerName: lawyer?.name ?? lawyer?.email ?? "",
        };
      }),
    );
    return rows.flatMap((row) => (row === null ? [] : [row]));
  },
});
