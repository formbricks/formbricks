import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { resetDb } from "@/integration/reset-db";
import { deleteFeedbackRecord, listFeedbackRecords } from "@/modules/hub/service";
import { deleteFile, deleteSurveyUploadFolder } from "@/modules/storage/service";
import { purgeExpiredArchivedSurveys } from "@/modules/survey/archive/lib/process-survey-archive-purge-job";
import { deleteSurvey } from "@/modules/survey/lib/surveys";
import { HUB_CLEANUP_SETTLE_MS } from "./constants";
import { drainDeletionCleanups } from "./drain";

// The two boundaries the drain talks to; everything else (the queue, the locks, the guards) is real.
vi.mock("@/modules/hub/service", () => ({
  deleteFeedbackRecord: vi.fn(),
  listFeedbackRecords: vi.fn(),
}));

vi.mock("@/modules/storage/service", () => ({
  deleteFile: vi.fn(),
  deleteSurveyUploadFolder: vi.fn(),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventWithoutRequest: vi.fn().mockResolvedValue(undefined),
}));

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date();
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);
const PURGE_CUTOFF = daysAgo(30);

const hubRecord = (id: string, tenantId: string, surveyId: string) => ({
  id,
  tenant_id: tenantId,
  source_type: "formbricks_survey",
  source_id: surveyId,
  submission_id: "resp",
});

describe("deletion cleanup (real Postgres)", () => {
  let organizationId: string;
  let workspaceId: string;
  let directoryIds: string[];

  const createSurvey = async (data: { archivedAt?: Date } = {}) =>
    (await prisma.survey.create({ data: { name: "Site visit", workspaceId, ...data } })).id;

  const hold = (surveyId: string, until: Date, revokedAt: Date | null = null) =>
    prisma.retentionExemption.create({
      data: { organizationId, entity: "responses", surveyId, until, revokedAt, reason: "Audit" },
    });

  const queueRows = () => prisma.deletionCleanup.findMany({ orderBy: { kind: "asc" } });

  beforeEach(async () => {
    vi.clearAllMocks();
    await resetDb();
    organizationId = (await prisma.organization.create({ data: { name: "Acme" } })).id;
    workspaceId = (await prisma.workspace.create({ data: { name: "Europe", organizationId } })).id;
    directoryIds = [
      (await prisma.feedbackDirectory.create({ data: { name: "Main", organizationId } })).id,
      (await prisma.feedbackDirectory.create({ data: { name: "Old", organizationId, isArchived: true } })).id,
    ];
    const otherOrganizationId = (await prisma.organization.create({ data: { name: "Other" } })).id;
    await prisma.feedbackDirectory.create({ data: { name: "Theirs", organizationId: otherOrganizationId } });

    vi.mocked(deleteSurveyUploadFolder).mockResolvedValue(true);
    vi.mocked(deleteFile).mockResolvedValue({ ok: true, data: undefined } as never);
    vi.mocked(deleteFeedbackRecord).mockResolvedValue({ data: { deleted: true }, error: null });
    vi.mocked(listFeedbackRecords).mockResolvedValue({ data: { data: [] }, error: null } as never);
  });

  describe("deleting a survey", () => {
    test("queues its Hub cleanup for every directory of its organisation, and drains storage at once", async () => {
      const surveyId = await createSurvey();

      await deleteSurvey(surveyId);

      expect(await prisma.survey.findUnique({ where: { id: surveyId } })).toBeNull();
      expect(deleteSurveyUploadFolder).toHaveBeenCalledWith({ workspaceId, surveyId });
      // The storage row is drained and gone; the Hub row waits for records still on their way.
      const [hubRow, ...rest] = await queueRows();
      expect(rest).toEqual([]);
      expect(hubRow).toMatchObject({ kind: "hubSurvey", organizationId, workspaceId, surveyId, attempts: 0 });
      expect(hubRow.tenantIds.sort()).toEqual([...directoryIds].sort());
      expect(hubRow.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + HUB_CLEANUP_SETTLE_MS - 60_000);
      expect(listFeedbackRecords).not.toHaveBeenCalled();
    });

    test("keeps a storage failure queued for the drain job, and still deletes the survey", async () => {
      vi.mocked(deleteSurveyUploadFolder).mockResolvedValue(false);
      const surveyId = await createSurvey();

      await deleteSurvey(surveyId);

      expect(await prisma.survey.findUnique({ where: { id: surveyId } })).toBeNull();
      const folderRow = (await queueRows()).find((row) => row.kind === "storageSurveyFolder");
      expect(folderRow).toMatchObject({ attempts: 1, lastError: "storage" });
      expect(folderRow?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("the archive purge", () => {
    test("never deletes a survey held by an exemption, and queues nothing for it", async () => {
      const held = await createSurvey({ archivedAt: daysAgo(90) });
      await hold(held, daysAgo(-10));

      await expect(deleteSurvey(held, { purgeCutoff: PURGE_CUTOFF })).rejects.toThrow(ResourceNotFoundError);

      expect(await prisma.survey.findUnique({ where: { id: held } })).not.toBeNull();
      expect(await queueRows()).toEqual([]);
      expect(deleteSurveyUploadFolder).not.toHaveBeenCalled();
    });

    test("gives a survey the full window again from when its exemption ended or was revoked", async () => {
      const endedRecently = await createSurvey({ archivedAt: daysAgo(90) });
      await hold(endedRecently, daysAgo(10));
      const revokedRecently = await createSurvey({ archivedAt: daysAgo(90) });
      await hold(revokedRecently, daysAgo(-100), daysAgo(5));
      const endedLongAgo = await createSurvey({ archivedAt: daysAgo(90) });
      await hold(endedLongAgo, daysAgo(60));
      const revokedLongAgo = await createSurvey({ archivedAt: daysAgo(90) });
      await hold(revokedLongAgo, daysAgo(-100), daysAgo(45));

      await expect(purgeExpiredArchivedSurveys(NOW)).resolves.toBe(2);

      const left = await prisma.survey.findMany({ select: { id: true } });
      expect(left.map((survey) => survey.id).sort()).toEqual([endedRecently, revokedRecently].sort());
    });

    test("purges the rest when more surveys are held than fit in one batch", async () => {
      const heldIds = await Promise.all(
        Array.from({ length: 101 }, () => createSurvey({ archivedAt: daysAgo(120) }))
      );
      await prisma.retentionExemption.createMany({
        data: heldIds.map((surveyId) => ({
          organizationId,
          entity: "surveys" as const,
          surveyId,
          until: daysAgo(-30),
          reason: "Audit",
        })),
      });
      // Archived later than every held survey, so an archivedAt-ordered page of held ones would hide it.
      const expired = await createSurvey({ archivedAt: daysAgo(60) });

      await expect(purgeExpiredArchivedSurveys(NOW)).resolves.toBe(1);

      expect(await prisma.survey.findUnique({ where: { id: expired } })).toBeNull();
      expect(await prisma.survey.count()).toBe(101);
    });
  });

  describe("draining", () => {
    const queueHubSurvey = (surveyId: string, data: { nextAttemptAt?: Date } = {}) =>
      prisma.deletionCleanup.create({
        data: {
          kind: "hubSurvey",
          organizationId,
          workspaceId,
          surveyId,
          tenantIds: directoryIds,
          nextAttemptAt: daysAgo(1),
          ...data,
        },
      });

    test("deletes a deleted survey's Hub records, then finishes only after a later pass finds none", async () => {
      const row = await queueHubSurvey("clgonesurvey0000000000001");
      vi.mocked(listFeedbackRecords)
        .mockResolvedValueOnce({
          data: { data: [hubRecord("r1", directoryIds[0], "clgonesurvey0000000000001")] },
          error: null,
        } as never)
        .mockResolvedValue({ data: { data: [] }, error: null } as never);

      await expect(drainDeletionCleanups()).resolves.toEqual({ done: 0, again: 1, failed: 0 });
      expect(deleteFeedbackRecord).toHaveBeenCalledWith("r1");
      const waiting = await prisma.deletionCleanup.findUniqueOrThrow({ where: { id: row.id } });
      expect(waiting.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + HUB_CLEANUP_SETTLE_MS - 60_000);

      await prisma.deletionCleanup.update({ where: { id: row.id }, data: { nextAttemptAt: daysAgo(1) } });
      await expect(drainDeletionCleanups()).resolves.toEqual({ done: 1, again: 0, failed: 0 });
      expect(await queueRows()).toEqual([]);
    });

    test("never touches the Hub or storage for a survey that still exists", async () => {
      const surveyId = await createSurvey();
      const row = await queueHubSurvey(surveyId);
      await prisma.deletionCleanup.create({
        data: {
          kind: "storageSurveyFolder",
          organizationId,
          workspaceId,
          surveyId,
          nextAttemptAt: daysAgo(1),
        },
      });

      await expect(drainDeletionCleanups()).resolves.toEqual({ done: 0, again: 0, failed: 2 });

      expect(listFeedbackRecords).not.toHaveBeenCalled();
      expect(deleteSurveyUploadFolder).not.toHaveBeenCalled();
      expect(await prisma.deletionCleanup.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({
        attempts: 1,
        lastError: "surveyExists",
      });
    });

    test("never deletes the Hub records of a response that still exists", async () => {
      const surveyId = await createSurvey();
      const liveResponseId = (await prisma.response.create({ data: { surveyId } })).id;
      const row = await prisma.deletionCleanup.create({
        data: {
          kind: "hubResponses",
          organizationId,
          workspaceId,
          surveyId,
          tenantIds: directoryIds,
          responseIds: ["clgoneresponse00000000001", liveResponseId],
          nextAttemptAt: daysAgo(1),
        },
      });

      await expect(drainDeletionCleanups()).resolves.toEqual({ done: 0, again: 0, failed: 1 });

      expect(listFeedbackRecords).not.toHaveBeenCalled();
      expect(await prisma.deletionCleanup.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({
        lastError: "responseExists",
      });
    });

    test("backs off a failing row, never gives up, and resets once it makes progress", async () => {
      const row = await queueHubSurvey("clgonesurvey0000000000002");
      vi.mocked(listFeedbackRecords).mockResolvedValue({
        data: null,
        error: { status: 503, message: "down", detail: "" },
      } as never);

      await drainDeletionCleanups();
      const first = await prisma.deletionCleanup.findUniqueOrThrow({ where: { id: row.id } });
      await prisma.deletionCleanup.update({ where: { id: row.id }, data: { nextAttemptAt: daysAgo(1) } });
      await drainDeletionCleanups();
      const second = await prisma.deletionCleanup.findUniqueOrThrow({ where: { id: row.id } });

      expect(first).toMatchObject({ attempts: 1, lastError: "hubList:503" });
      expect(second).toMatchObject({ attempts: 2, lastError: "hubList:503" });
      // A minute, then two.
      expect(second.nextAttemptAt.getTime() - second.updatedAt.getTime()).toBeGreaterThan(110_000);

      vi.mocked(listFeedbackRecords).mockResolvedValue({ data: { data: [] }, error: null } as never);
      await prisma.deletionCleanup.update({ where: { id: row.id }, data: { nextAttemptAt: daysAgo(1) } });
      await expect(drainDeletionCleanups()).resolves.toEqual({ done: 1, again: 0, failed: 0 });
    });

    test("keeps only the files that failed, and leaves a row not yet due alone", async () => {
      const urls = ["a.png", "b.png", "c.png"].map((name) => `/storage/${workspaceId}/private/${name}`);
      const row = await prisma.deletionCleanup.create({
        data: {
          kind: "storageFiles",
          organizationId,
          workspaceId,
          surveyId: "clgonesurvey0000000000003",
          fileKeys: urls,
          nextAttemptAt: daysAgo(1),
        },
      });
      const notDue = await queueHubSurvey("clgonesurvey0000000000004", { nextAttemptAt: daysAgo(-1) });
      vi.mocked(deleteFile).mockImplementation((async (_id: string, _access: string, name: string) =>
        name === "b.png" ? { ok: false, error: { code: "s3_client_error" } } : { ok: true }) as never);

      await expect(drainDeletionCleanups()).resolves.toEqual({ done: 0, again: 0, failed: 1 });

      expect(await prisma.deletionCleanup.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({
        fileKeys: [urls[1]],
        attempts: 1,
      });
      expect(await prisma.deletionCleanup.findUniqueOrThrow({ where: { id: notDue.id } })).toMatchObject({
        attempts: 0,
      });
      expect(listFeedbackRecords).not.toHaveBeenCalled();
    });

    test("lets concurrent drains split the queue rather than both take a row", async () => {
      for (let i = 0; i < 4; i += 1) {
        await prisma.deletionCleanup.create({
          data: {
            kind: "storageSurveyFolder",
            organizationId,
            workspaceId,
            surveyId: `clgonesurvey000000000001${i}`,
            nextAttemptAt: daysAgo(1),
          },
        });
      }
      vi.mocked(deleteSurveyUploadFolder).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return true;
      });

      const results = await Promise.all([drainDeletionCleanups(), drainDeletionCleanups()]);

      expect(results.reduce((total, result) => total + result.done, 0)).toBe(4);
      expect(deleteSurveyUploadFolder).toHaveBeenCalledTimes(4);
      expect(await queueRows()).toEqual([]);
    });
  });
});
