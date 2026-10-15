import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { purgeExpiredArchivedSurveys } from "@/modules/survey/archive/lib/process-survey-archive-purge-job";
import { deleteSurvey } from "@/modules/survey/lib/surveys";
import { createRetentionPurgeHistory } from "./retention-purge-history";

// The boundaries a survey delete talks to beyond the database; the delete, its guard and History are real.
vi.mock("@/modules/hub/service", () => ({ deleteFeedbackRecord: vi.fn(), listFeedbackRecords: vi.fn() }));
vi.mock("@/modules/storage/service", () => ({
  deleteFile: vi.fn(),
  deleteSurveyUploadFolder: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventWithoutRequest: vi.fn().mockResolvedValue(undefined),
}));

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

/**
 * What data retention History keeps of a deleted survey (ENG-3614), against a real database: the
 * archive purge records the deletion of a survey the surveys policy archived, in a run of its own that
 * the sweep doesn't count as its own; and a deleted survey's name leaves History with it, however it
 * goes (the `retention_run_item_scrub_on_survey_delete` trigger).
 */
describe("retention History of deleted surveys (real Postgres)", () => {
  let organizationId: string;
  let workspaceId: string;

  const createSurvey = async (name: string, archivedAt: Date | null = null) =>
    (await prisma.survey.create({ data: { name, workspaceId, status: "paused", archivedAt } })).id;

  /** A finished surveys sweep run that archived (or notified about) these surveys, names and all. */
  const sweepRun = async (items: { surveyId: string; name: string; action: "archived" | "notified" }[]) => {
    const run = await prisma.retentionRun.create({
      data: { organizationId, entity: "surveys", startedAt: ago(40), finishedAt: ago(40), hasChanges: true },
    });
    await prisma.retentionRunItem.createMany({
      data: items.map((item) => ({
        runId: run.id,
        targetType: "survey" as const,
        targetId: item.surveyId,
        targetName: item.name,
        action: item.action,
      })),
    });
    return run.id;
  };

  beforeEach(async () => {
    await resetDb();
    organizationId = (await prisma.organization.create({ data: { name: "Acme" } })).id;
    workspaceId = (await prisma.workspace.create({ data: { name: "Europe", organizationId } })).id;
  });

  test("the purge records a deletion only for surveys the policy archived, in a purge run", async () => {
    const byPolicy = await createSurvey("Old feedback", ago(35));
    const byHand = await createSurvey("Archived by hand", ago(35));
    await sweepRun([{ surveyId: byPolicy, name: "Old feedback", action: "archived" }]);

    await expect(purgeExpiredArchivedSurveys(new Date())).resolves.toBe(2);

    const purgeRuns = await prisma.retentionRun.findMany({
      where: { kind: "purge" },
      include: { items: true },
    });
    expect(purgeRuns).toEqual([
      expect.objectContaining({
        organizationId,
        entity: "surveys",
        deletedCount: 1,
        hasChanges: true,
        finishedAt: expect.any(Date),
        items: [
          expect.objectContaining({
            targetType: "survey",
            targetId: byPolicy,
            action: "deleted",
            targetName: null,
          }),
        ],
      }),
    ]);
    expect(await prisma.retentionRunItem.count({ where: { targetId: byHand } })).toBe(0);
  });

  test("a purge that dies before closing its run still shows the deletion in History", async () => {
    const byPolicy = await createSurvey("Old feedback", ago(35));
    await sweepRun([{ surveyId: byPolicy, name: "Old feedback", action: "archived" }]);
    const history = createRetentionPurgeHistory();
    const runId = await history.runFor(organizationId);

    await deleteSurvey(byPolicy, { inTransaction: (tx) => history.recordDeletion(tx, runId, byPolicy) });
    // No close(): the process went away.

    expect(await prisma.retentionRun.findUniqueOrThrow({ where: { id: runId } })).toMatchObject({
      kind: "purge",
      deletedCount: 1,
      hasChanges: true,
      finishedAt: null,
    });
  });

  test("a purge that records nothing leaves no run behind", async () => {
    await createSurvey("Archived by hand", ago(35));

    await purgeExpiredArchivedSurveys(new Date());

    expect(await prisma.retentionRun.count({ where: { kind: "purge" } })).toBe(0);
  });

  test("a delete the purge's guard refuses records nothing", async () => {
    const held = await createSurvey("Held", ago(35));
    await sweepRun([{ surveyId: held, name: "Held", action: "archived" }]);
    await prisma.retentionExemption.create({
      data: { organizationId, entity: "surveys", surveyId: held, until: ago(-30), reason: "Audit" },
    });

    await expect(purgeExpiredArchivedSurveys(new Date())).resolves.toBe(0);

    expect(await prisma.survey.count({ where: { id: held } })).toBe(1);
    expect(await prisma.retentionRunItem.count({ where: { action: "deleted" } })).toBe(0);
  });

  test("a deleted survey's name leaves History, by any path; other surveys keep theirs", async () => {
    const gone = await createSurvey("Exit interview – Jane Doe");
    const kept = await createSurvey("Still here");
    await sweepRun([
      { surveyId: gone, name: "Exit interview – Jane Doe", action: "notified" },
      { surveyId: kept, name: "Still here", action: "notified" },
    ]);

    await deleteSurvey(gone);

    const names = await prisma.retentionRunItem.findMany({ select: { targetId: true, targetName: true } });
    expect(names).toEqual(
      expect.arrayContaining([
        { targetId: gone, targetName: null },
        { targetId: kept, targetName: "Still here" },
      ])
    );
  });

  test("a workspace delete, which takes its surveys by cascade, scrubs their names too", async () => {
    const survey = await createSurvey("Exit interview – Jane Doe");
    await sweepRun([{ surveyId: survey, name: "Exit interview – Jane Doe", action: "notified" }]);

    await prisma.workspace.delete({ where: { id: workspaceId } });

    expect(await prisma.retentionRunItem.findFirstOrThrow({ where: { targetId: survey } })).toMatchObject({
      targetName: null,
    });
  });
});
