import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import {
  addFirmMember,
  bootstrapFirm,
  makeTest,
  seedCaseType,
  seedParty,
} from "./testHelpers.ts";

describe("command palette", () => {
  test("searches cases and parties from one firm-scoped endpoint", async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    await owner.authed.mutation(api.cases.create, {
      internalNumber: "LAW-204",
      courtNumber: "CT-91",
      caseTypeId,
      primaryLawyerId: owner.userId,
    });
    await seedParty(t, owner, "900012345", "Maha Nassar");

    const cases = await owner.authed.query(api.commandPalette.search, {
      queryText: "LAW",
    });
    const parties = await owner.authed.query(api.commandPalette.search, {
      queryText: "Maha",
    });

    expect(cases.cases.map((row) => row.internalNumber)).toContain("LAW-204");
    expect(parties.parties.map((row) => row.fullName)).toContain("Maha Nassar");
  });

  test("a lawyer only receives their own cases and documents", async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyerA = await addFirmMember(t, firmId, "lawyer", {
      name: "Lawyer A",
      email: "lawyer-a@example.com",
    });
    const lawyerB = await addFirmMember(t, firmId, "lawyer", {
      name: "Lawyer B",
      email: "lawyer-b@example.com",
    });
    const ownCaseId = await lawyerA.authed.mutation(api.cases.create, {
      internalNumber: "VISIBLE-1",
      caseTypeId,
      primaryLawyerId: lawyerA.userId,
    });
    await lawyerB.authed.mutation(api.cases.create, {
      internalNumber: "HIDDEN-1",
      caseTypeId,
      primaryLawyerId: lawyerB.userId,
    });

    const result = await lawyerA.authed.query(api.commandPalette.search, {
      queryText: "",
      scope: "cases",
    });

    expect(result.cases.map((row) => row.id)).toEqual([ownCaseId]);
  });

  test("never returns results belonging to a different firm", async () => {
    const t = makeTest();
    const first = await bootstrapFirm(t, { ownerEmail: "first@example.com" });
    const second = await bootstrapFirm(t, { ownerEmail: "second@example.com" });
    const firstTypeId = await seedCaseType(t, first.owner, {
      key: "first-type",
    });
    const secondTypeId = await seedCaseType(t, second.owner, {
      key: "second-type",
    });
    await first.owner.authed.mutation(api.cases.create, {
      internalNumber: "SHARED-101",
      caseTypeId: firstTypeId,
      primaryLawyerId: first.owner.userId,
    });
    await second.owner.authed.mutation(api.cases.create, {
      internalNumber: "SHARED-202",
      caseTypeId: secondTypeId,
      primaryLawyerId: second.owner.userId,
    });

    const result = await first.owner.authed.query(api.commandPalette.search, {
      queryText: "SHARED",
    });

    expect(result.cases.map((row) => row.internalNumber)).toEqual([
      "SHARED-101",
    ]);
  });
});
