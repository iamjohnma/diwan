import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import {
  bootstrapFirm,
  makeTest,
  seedCase,
  seedCaseType,
  seedParty,
} from "./testHelpers.ts";

describe("dashboard", () => {
  test("returns live KPI, cash-flow, case, and hearing data", async () => {
    const testContext = makeTest();
    const { owner, firmId } = await bootstrapFirm(testContext);
    const caseTypeId = await seedCaseType(testContext, owner);
    const caseId = await seedCase(testContext, caseTypeId, owner, "DASH-100");
    const partyId = await seedParty(
      testContext,
      owner,
      "900000001",
      "Dashboard Client",
    );
    await owner.authed.mutation(api.payments.recordAdjustment, {
      caseId,
      personId: partyId,
      amount: 500,
      reason: "Fee agreement",
    });
    await owner.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId: partyId,
      accountType: "fee",
      amount: 200,
      method: "cash",
      date: Date.now(),
    });
    const referenceTimestamp = Date.now();
    const hearingDate = referenceTimestamp + 30 * 60_000;
    await testContext.run(async (ctx) => {
      await ctx.db.insert("hearings", {
        firmId,
        caseId,
        date: hearingDate,
        court: "Court of First Instance",
        hall: "3",
        lawyerId: owner.userId,
        createdAt: referenceTimestamp,
        updatedAt: referenceTimestamp,
      });
    });

    const [kpi, cashFlow, hearings, matchingCases] = await Promise.all([
      owner.authed.query(api.dashboard.getKpiStats, {}),
      owner.authed.query(api.dashboard.getCashFlow, {
        period: "weekly",
        referenceTimestamp,
      }),
      owner.authed.query(api.dashboard.getTodayHearings, {
        timezoneOffsetMinutes: 0,
        referenceTimestamp,
        currentTimestamp: referenceTimestamp,
      }),
      owner.authed.query(api.cases.listTablePage, {
        searchText: "DASH-100",
        page: 1,
        pageSize: 5,
      }),
    ]);

    expect(kpi.revenue).toEqual({ total: 200, paymentsCount: 1 });
    expect(kpi.outstandingBalance).toBe(300);
    expect(kpi.activeCases).toEqual({ total: 1, intake: 1 });
    expect(cashFlow.data).toHaveLength(12);
    expect(cashFlow.total).toBe(200);
    expect(hearings).toHaveLength(1);
    expect(hearings[0]?.caseNumber).toBe("DASH-100");
    expect(matchingCases.rows.map((row) => row.internalNumber)).toEqual([
      "DASH-100",
    ]);
  });
});
