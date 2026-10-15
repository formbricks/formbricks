import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import type { RetentionSurveyCondition } from "@formbricks/database/prisma";
import { resetDb } from "@/integration/reset-db";
import { restoreSurvey } from "@/modules/survey/lib/surveys";

const DAY = 24 * 60 * 60 * 1000;
const PERIOD = 1095;
const ago = (days: number) => new Date(Date.now() - days * DAY);

/**
 * What a restore from the archive does to data retention, against a real database: it records the
 * restore, and under a surveys policy whose only condition is "created before" it exempts the survey for
 * one period. How the sweep then treats the survey is in `surveys-sweeper.integration.test.ts`.
 */
describe("restoring a survey restarts its data retention (real Postgres)", () => {
  let organizationId: string;
  let workspaceId: string;
  let userId: string;

  /** History's record that the surveys policy archived it, in a sweep run started at `runStartedAt`. */
  const recordPolicyArchive = async (surveyId: string, runStartedAt = ago(1)) => {
    const run = await prisma.retentionRun.create({
      data: { organizationId, entity: "surveys", startedAt: runStartedAt, finishedAt: runStartedAt },
    });
    await prisma.retentionRunItem.create({
      data: { runId: run.id, targetType: "survey", targetId: surveyId, action: "archived" },
    });
  };

  /** A survey the surveys policy archived, unless `byHand`. */
  const archivedSurvey = async ({ byHand = false }: { byHand?: boolean } = {}) => {
    const { id } = await prisma.survey.create({
      data: { name: "Old feedback", workspaceId, status: "paused", archivedAt: ago(1) },
    });
    if (!byHand) await recordPolicyArchive(id, ago(1));
    return id;
  };

  const surveysPolicy = (conditions: RetentionSurveyCondition[], enabled = true) =>
    prisma.retentionPolicy.create({
      data: {
        organizationId,
        entity: "surveys",
        enabled,
        enabledAt: enabled ? ago(10) : null,
        warnDays: 60,
        periodDays: PERIOD,
        conditions,
      },
    });

  beforeEach(async () => {
    await resetDb();
    organizationId = (await prisma.organization.create({ data: { name: "Acme" } })).id;
    workspaceId = (await prisma.workspace.create({ data: { name: "Europe", organizationId } })).id;
    userId = (await prisma.user.create({ data: { name: "Ada", email: "ada@example.com" } })).id;
  });

  test("records the restore, and only ever moves it forward", async () => {
    const surveyId = await archivedSurvey();

    await restoreSurvey(surveyId);
    const first = await prisma.retentionSurveyRestore.findUniqueOrThrow({ where: { surveyId } });
    expect(Math.abs(Date.now() - first.restoredAt.getTime())).toBeLessThan(60_000);

    // A marker somehow ahead of the clock stays where it is (archived by the policy again after it).
    const ahead = new Date(Date.now() + DAY);
    await prisma.retentionSurveyRestore.update({ where: { surveyId }, data: { restoredAt: ahead } });
    await prisma.survey.update({ where: { id: surveyId }, data: { archivedAt: new Date() } });
    await recordPolicyArchive(surveyId, new Date(Date.now() + 2 * DAY));
    await restoreSurvey(surveyId);
    expect(
      (await prisma.retentionSurveyRestore.findUniqueOrThrow({ where: { surveyId } })).restoredAt
    ).toEqual(ahead);
  });

  test("restoring a survey archived by hand restarts nothing: no marker, no exemption", async () => {
    await surveysPolicy(["createdBefore"]);
    const surveyId = await archivedSurvey({ byHand: true });

    await expect(restoreSurvey(surveyId, { restoredById: userId })).resolves.toMatchObject({
      archivedAt: null,
      retentionExemptionId: null,
    });

    expect(await prisma.retentionSurveyRestore.count()).toBe(0);
    expect(await prisma.retentionExemption.count()).toBe(0);
  });

  test("a policy archive from before the last restore doesn't count: archiving by hand since restarts nothing", async () => {
    await surveysPolicy(["createdBefore"]);
    const surveyId = await archivedSurvey();
    await restoreSurvey(surveyId, { restoredById: userId });
    await prisma.retentionExemption.deleteMany();
    const marker = await prisma.retentionSurveyRestore.findUniqueOrThrow({ where: { surveyId } });

    // Archived again, by hand this time, and restored.
    await prisma.survey.update({ where: { id: surveyId }, data: { archivedAt: new Date() } });
    await restoreSurvey(surveyId, { restoredById: userId });

    expect(await prisma.retentionExemption.count()).toBe(0);
    expect(await prisma.retentionSurveyRestore.findUniqueOrThrow({ where: { surveyId } })).toEqual(marker);
  });

  test("restoring a survey that isn't archived changes nothing for retention", async () => {
    await surveysPolicy(["createdBefore"]);
    const { id: surveyId, updatedAt } = await prisma.survey.create({ data: { name: "Live", workspaceId } });

    await expect(restoreSurvey(surveyId)).resolves.toMatchObject({ retentionExemptionId: null });
    // Not even a write: it would bump updated_at, the "no changes" clock.
    expect((await prisma.survey.findUniqueOrThrow({ where: { id: surveyId } })).updatedAt).toEqual(updatedAt);

    expect(await prisma.retentionSurveyRestore.count()).toBe(0);
    expect(await prisma.retentionExemption.count()).toBe(0);
  });

  test("under 'created before' alone, exempts the survey for one period, as the restorer", async () => {
    await surveysPolicy(["createdBefore"]);
    const surveyId = await archivedSurvey();

    const result = await restoreSurvey(surveyId, { restoredById: userId });

    const exemption = await prisma.retentionExemption.findFirstOrThrow({ where: { surveyId } });
    expect(result).toMatchObject({ archivedAt: null, retentionExemptionId: exemption.id });
    expect(exemption).toMatchObject({
      organizationId,
      entity: "surveys",
      source: "restore",
      reason: null,
      createdById: userId,
      revokedAt: null,
    });
    const restoredAt = (await prisma.retentionSurveyRestore.findUniqueOrThrow({ where: { surveyId } }))
      .restoredAt;
    expect(exemption.until.getTime() - restoredAt.getTime()).toBe(PERIOD * DAY);
    expect(exemption.createdAt).toEqual(restoredAt);
  });

  test("a restore through an API key exempts it with no creator", async () => {
    await surveysPolicy(["createdBefore"]);
    const surveyId = await archivedSurvey();

    await restoreSurvey(surveyId);

    expect(await prisma.retentionExemption.findFirstOrThrow({ where: { surveyId } })).toMatchObject({
      source: "restore",
      createdById: null,
    });
  });

  test.each<[string, RetentionSurveyCondition[], boolean]>([
    [
      "'created before' with another condition, which the restore already starts over",
      ["createdBefore", "noChange"],
      true,
    ],
    ["a policy without 'created before'", ["noResponse"], true],
    ["a paused policy", ["createdBefore"], false],
  ])("makes no exemption under %s", async (_label, conditions, enabled) => {
    await surveysPolicy(conditions, enabled);
    const surveyId = await archivedSurvey();

    await expect(restoreSurvey(surveyId, { restoredById: userId })).resolves.toMatchObject({
      retentionExemptionId: null,
    });

    expect(await prisma.retentionExemption.count()).toBe(0);
    expect(await prisma.retentionSurveyRestore.count()).toBe(1);
  });

  test("makes no exemption for an organisation with no surveys policy, or another organisation's", async () => {
    const otherOrganizationId = (await prisma.organization.create({ data: { name: "Other" } })).id;
    await prisma.retentionPolicy.create({
      data: {
        organizationId: otherOrganizationId,
        entity: "surveys",
        enabled: true,
        enabledAt: ago(10),
        warnDays: 60,
        periodDays: PERIOD,
        conditions: ["createdBefore"],
      },
    });
    const surveyId = await archivedSurvey();

    await restoreSurvey(surveyId, { restoredById: userId });

    expect(await prisma.retentionExemption.count()).toBe(0);
  });

  test("keeps a survey's active exemption rather than adding a second", async () => {
    await surveysPolicy(["createdBefore"]);
    const surveyId = await archivedSurvey();
    const existing = await prisma.retentionExemption.create({
      data: { organizationId, entity: "surveys", surveyId, until: ago(-30), reason: "Audit" },
    });

    await expect(restoreSurvey(surveyId, { restoredById: userId })).resolves.toMatchObject({
      retentionExemptionId: null,
    });

    expect(await prisma.retentionExemption.findMany({ where: { surveyId } })).toEqual([
      expect.objectContaining({ id: existing.id, source: "manual", revokedAt: null }),
    ]);
  });

  test("closes an ended, unrevoked exemption, then adds the restore's", async () => {
    await surveysPolicy(["createdBefore"]);
    const surveyId = await archivedSurvey();
    const ended = await prisma.retentionExemption.create({
      data: { organizationId, entity: "surveys", surveyId, until: ago(5), reason: "Audit" },
    });

    const { retentionExemptionId } = await restoreSurvey(surveyId, { restoredById: userId });

    expect(retentionExemptionId).not.toBeNull();
    expect(await prisma.retentionExemption.findUniqueOrThrow({ where: { id: ended.id } })).toMatchObject({
      revokedAt: ended.until,
      revokedById: null,
    });
  });

  test("a responses exemption doesn't stand in for the surveys one", async () => {
    await surveysPolicy(["createdBefore"]);
    const surveyId = await archivedSurvey();
    await prisma.retentionExemption.create({
      data: { organizationId, entity: "responses", surveyId, until: ago(-30), reason: "Audit" },
    });

    const { retentionExemptionId } = await restoreSurvey(surveyId, { restoredById: userId });

    expect(retentionExemptionId).not.toBeNull();
    expect(await prisma.retentionExemption.count({ where: { surveyId, revokedAt: null } })).toBe(2);
  });

  test("the database refuses a person's exemption without a reason, and a restore's with one", async () => {
    const surveyId = await archivedSurvey();
    const base = { organizationId, entity: "surveys" as const, surveyId, until: ago(-30) };

    await expect(prisma.retentionExemption.create({ data: { ...base, source: "manual" } })).rejects.toThrow();
    await expect(
      prisma.retentionExemption.create({ data: { ...base, source: "restore", reason: "Audit" } })
    ).rejects.toThrow();
  });
});
