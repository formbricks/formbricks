import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { resetDb } from "@/integration/reset-db";
import { deleteFeedbackRecord, listFeedbackRecords } from "@/modules/hub/service";
import { collectSurveyResponseFileUrls } from "@/modules/storage/lib/survey-response-files";
import { deleteFile, deleteSurveyUploadFolder } from "@/modules/storage/service";
import { purgeExpiredArchivedSurveys } from "@/modules/survey/archive/lib/process-survey-archive-purge-job";
import { deleteSurvey } from "@/modules/survey/lib/surveys";
import { CLEANUP_SETTLE_MS } from "./constants";
import { drainDeletionCleanups } from "./drain";
import { enqueueSurveyDeletionCleanups } from "./enqueue";

// Run budgets a test can shrink; read through getters, so the drain sees the current value.
const budgets = vi.hoisted(() => ({ hubCalls: 0, runMs: 0 }));
vi.mock("./constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./constants")>();
  return {
    ...actual,
    get DELETION_CLEANUP_HUB_CALL_BUDGET() {
      return budgets.hubCalls || actual.DELETION_CLEANUP_HUB_CALL_BUDGET;
    },
    get DELETION_CLEANUP_RUN_BUDGET_MS() {
      return budgets.runMs || actual.DELETION_CLEANUP_RUN_BUDGET_MS;
    },
  };
});

// Real implementations, wrapped so a test can make one call misbehave.
vi.mock("./enqueue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./enqueue")>();
  return { enqueueSurveyDeletionCleanups: vi.fn(actual.enqueueSurveyDeletionCleanups) };
});
vi.mock("@/modules/storage/lib/survey-response-files", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/storage/lib/survey-response-files")>();
  return { ...actual, collectSurveyResponseFileUrls: vi.fn(actual.collectSurveyResponseFileUrls) };
});

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
    budgets.hubCalls = 0;
    budgets.runMs = 0;
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
      // The first sweep is drained and gone. The Hub cleanup and a second sweep (for an upload signed
      // before the delete) wait for what can still land.
      const [hubRow, laterSweep, ...rest] = await queueRows();
      expect(rest).toEqual([]);
      expect(hubRow).toMatchObject({ kind: "hubSurvey", organizationId, workspaceId, surveyId, attempts: 0 });
      expect(hubRow.tenantIds.sort()).toEqual([...directoryIds].sort());
      expect(laterSweep).toMatchObject({ kind: "storageSurveyFolder", surveyId, attempts: 0 });
      for (const row of [hubRow, laterSweep]) {
        expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + CLEANUP_SETTLE_MS - 60_000);
      }
      expect(deleteSurveyUploadFolder).toHaveBeenCalledTimes(1);
      expect(listFeedbackRecords).not.toHaveBeenCalled();
    });

    test("keeps a storage failure queued for the drain job, and still deletes the survey", async () => {
      vi.mocked(deleteSurveyUploadFolder).mockResolvedValue(false);
      const surveyId = await createSurvey();

      await deleteSurvey(surveyId);

      expect(await prisma.survey.findUnique({ where: { id: surveyId } })).toBeNull();
      const folderRow = (await queueRows()).find((row) => row.lastError !== null);
      expect(folderRow).toMatchObject({ kind: "storageSurveyFolder", attempts: 1, lastError: "storage" });
      expect(folderRow?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    });

    test("queues nothing when the transaction fails after queueing", async () => {
      const surveyId = await createSurvey();
      vi.mocked(enqueueSurveyDeletionCleanups).mockImplementationOnce(async (tx, input) => {
        const actual = await vi.importActual<typeof import("./enqueue")>("./enqueue");
        await actual.enqueueSurveyDeletionCleanups(tx, input);
        throw new Error("a later statement failed");
      });

      await expect(deleteSurvey(surveyId)).rejects.toThrow("a later statement failed");

      expect(await prisma.survey.findUnique({ where: { id: surveyId } })).not.toBeNull();
      expect(await queueRows()).toEqual([]);
      expect(deleteSurveyUploadFolder).not.toHaveBeenCalled();
    });

    test("queues one storage row per hundred flat-key files", async () => {
      const surveyId = await createSurvey();
      const fileUrls = Array.from({ length: 250 }, (_, i) => `/storage/${workspaceId}/private/f${i}.png`);

      await prisma.$transaction((tx) =>
        enqueueSurveyDeletionCleanups(tx, { organizationId, workspaceId, surveyId, fileUrls })
      );

      const fileRows = (await queueRows()).filter((row) => row.kind === "storageFiles");
      expect(fileRows.map((row) => row.fileKeys.length).sort()).toEqual([100, 100, 50]);
      expect(fileRows.flatMap((row) => row.fileKeys).sort()).toEqual([...fileUrls].sort());
    });
  });

  describe("the archive purge", () => {
    test("loses to an exemption created between its pre-check and its lock", async () => {
      const surveyId = await createSurvey({ archivedAt: daysAgo(90) });
      vi.mocked(collectSurveyResponseFileUrls).mockImplementationOnce(async () => {
        await hold(surveyId, daysAgo(-10));
        return { fileUrls: [], workspaceId };
      });

      await expect(deleteSurvey(surveyId, { purgeCutoff: PURGE_CUTOFF })).rejects.toThrow(
        ResourceNotFoundError
      );

      expect(await prisma.survey.findUnique({ where: { id: surveyId } })).not.toBeNull();
      expect(await queueRows()).toEqual([]);
    });

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
      expect(waiting.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + CLEANUP_SETTLE_MS - 60_000);

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

    test("stops at the Hub call budget and hands the rest back for the next run", async () => {
      budgets.hubCalls = 250;
      const first = await queueHubSurvey("clgonesurvey0000000000005", { nextAttemptAt: daysAgo(2) });
      const second = await queueHubSurvey("clgonesurvey0000000000006", { nextAttemptAt: daysAgo(1) });
      // Every listing is a full page, as for a survey with far more records than one run can delete.
      vi.mocked(listFeedbackRecords).mockImplementation((async (params: {
        tenant_id: string;
        source_id: string[];
      }) => ({
        data: {
          data: Array.from({ length: 100 }, (_, i) =>
            hubRecord(`r${i}`, params.tenant_id, params.source_id[0])
          ),
        },
        error: null,
      })) as never);

      await expect(drainDeletionCleanups()).resolves.toEqual({ done: 0, again: 1, failed: 0 });

      // Two pages of 101 calls fit in 250; the first row is due again at once, the second untouched.
      expect(deleteFeedbackRecord).toHaveBeenCalledTimes(200);
      expect(
        vi
          .mocked(listFeedbackRecords)
          .mock.calls.every(([params]) => params.source_id?.[0] === first.surveyId)
      ).toBe(true);
      for (const id of [first.id, second.id]) {
        const row = await prisma.deletionCleanup.findUniqueOrThrow({ where: { id } });
        expect(row.attempts).toBe(0);
        expect(row.nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now());
      }
    });

    test("stops at the run's deadline and hands the rest back", async () => {
      budgets.runMs = 50;
      const rows = [];
      for (let i = 0; i < 2; i += 1) {
        rows.push(
          await prisma.deletionCleanup.create({
            data: {
              kind: "storageSurveyFolder",
              organizationId,
              workspaceId,
              surveyId: `clgonesurvey000000000002${i}`,
              nextAttemptAt: daysAgo(2 - i),
            },
          })
        );
      }
      vi.mocked(deleteSurveyUploadFolder).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return true;
      });

      await expect(drainDeletionCleanups()).resolves.toEqual({ done: 1, again: 0, failed: 0 });

      const left = await prisma.deletionCleanup.findUniqueOrThrow({ where: { id: rows[1].id } });
      expect(left.nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(deleteSurveyUploadFolder).toHaveBeenCalledTimes(1);
    });

    test("leaves a row alone once another drain has claimed it since", async () => {
      const row = await prisma.deletionCleanup.create({
        data: {
          kind: "storageSurveyFolder",
          organizationId,
          workspaceId,
          surveyId: "clgonesurvey0000000000030",
          nextAttemptAt: daysAgo(1),
        },
      });
      const newerLease = new Date(Date.now() + 60 * 60 * 1000);
      // This drain's lease runs out mid-row and another claims it before this one fails.
      vi.mocked(deleteSurveyUploadFolder).mockImplementation(async () => {
        await prisma.deletionCleanup.update({ where: { id: row.id }, data: { nextAttemptAt: newerLease } });
        return false;
      });

      await drainDeletionCleanups();

      expect(await prisma.deletionCleanup.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({
        attempts: 0,
        lastError: null,
        nextAttemptAt: newerLease,
      });
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
