import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";

/**
 * The CHECK constraints are backstops for writers that skip the API's validation (the sweep, scripts):
 * each guards a mistake that would delete or notify wrongly.
 */
describe("data retention schema backstops (real Postgres)", () => {
  let organizationId: string;
  let surveyId: string;

  beforeEach(async () => {
    await resetDb();
    organizationId = (await prisma.organization.create({ data: { name: "Retention Org" } })).id;
    const workspaceId = (await prisma.workspace.create({ data: { name: "Europe", organizationId } })).id;
    surveyId = (await prisma.survey.create({ data: { name: "Site visit", workspaceId } })).id;
  });

  test("refuses a notice shorter than two weeks, which could delete early", async () => {
    await expect(
      prisma.retentionPolicy.create({
        data: { organizationId, entity: "responses", warnDays: 13, periodDays: 30 },
      })
    ).rejects.toThrow();
    await expect(
      prisma.retentionPolicy.create({
        data: { organizationId, entity: "responses", warnDays: 14, periodDays: 30 },
      })
    ).resolves.toBeDefined();
  });

  test("refuses a notice as long as the period, and an enabled policy with no start", async () => {
    await expect(
      prisma.retentionPolicy.create({
        data: { organizationId, entity: "members", warnDays: 60, periodDays: 60 },
      })
    ).rejects.toThrow();
    await expect(
      prisma.retentionPolicy.create({
        data: { organizationId, entity: "members", warnDays: 14, periodDays: 30, enabled: true },
      })
    ).rejects.toThrow();
  });

  test("holds a responses reminder to a survey, and an email sent to a delivery time", async () => {
    await expect(
      prisma.retentionNotice.create({ data: { organizationId, entity: "responses", surveyId } })
    ).resolves.toBeDefined();
    await expect(
      prisma.retentionNotice.create({
        data: { organizationId, entity: "surveys", surveyId, emailSent: true },
      })
    ).rejects.toThrow();
  });

  test("never lets a cleanup widen: survey cleanups name no responses, response cleanups always do", async () => {
    const base = { organizationId, workspaceId: "clwsp", surveyId, tenantIds: ["cldir"] };

    await expect(
      prisma.deletionCleanup.create({ data: { ...base, kind: "hubResponses" } })
    ).rejects.toThrow();
    await expect(
      prisma.deletionCleanup.create({ data: { ...base, kind: "hubSurvey", responseIds: ["clres"] } })
    ).rejects.toThrow();
    await expect(
      prisma.deletionCleanup.create({ data: { ...base, kind: "storageFiles" } })
    ).rejects.toThrow();
    await expect(
      prisma.deletionCleanup.create({ data: { ...base, kind: "hubResponses", responseIds: ["clres"] } })
    ).resolves.toBeDefined();
  });

  test("refuses a NULL list too, which a raw insert could bind", async () => {
    const insert = (kind: string) => prisma.$executeRaw`
      INSERT INTO "DeletionCleanup" ("id", "updated_at", "kind", "organizationId", "workspaceId", "surveyId", "responseIds", "fileKeys")
      VALUES (${`clclean${kind}`}, now(), ${kind}::"DeletionCleanupKind", ${organizationId}, 'clwsp', ${surveyId}, NULL, NULL)
    `;

    await expect(insert("hubResponses")).rejects.toThrow();
    await expect(insert("storageFiles")).rejects.toThrow();
    await expect(insert("hubSurvey")).resolves.toBe(1);
  });
});
