import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { sendSurveyRetentionNoticeEmail } from "@/modules/email";
import { deleteFile, deleteSurveyUploadFolder } from "@/modules/storage/service";
import { updateRetentionPolicy } from "../lib/policies-service";
import { getRetentionClockCutoffs } from "../lib/schedule";
import { createResponsesSweeper, deleteDueResponses } from "./responses-sweeper";
import { openRetentionRun } from "./run";
import { markRetentionPolicyDelete } from "./survey-notice-restamp";
import { createSurveysSweeper } from "./surveys-sweeper";
import { runDataRetentionSweep } from "./sweep";

vi.mock("@/modules/email", () => ({ sendSurveyRetentionNoticeEmail: vi.fn() }));
vi.mock("@/modules/storage/service", () => ({ deleteFile: vi.fn(), deleteSurveyUploadFolder: vi.fn() }));
vi.mock("@/modules/hub/service", () => ({ deleteFeedbackRecord: vi.fn(), listFeedbackRecords: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventWithoutRequest: vi.fn().mockResolvedValue(undefined),
}));

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
// warnDays 30, periodDays 365: due for the reminder after 335 days, for deletion after 365.
const WARN = 30;
const PERIOD = 365;

describe("responses sweeper (real Postgres)", () => {
  let organizationId: string;
  let workspaceId: string;
  let ownerId: string;
  let surveyId: string;
  let readable: Set<string> | null;

  const canRead = async (actor: { id: string }, surveyIds: ReadonlyArray<string>) =>
    new Set(surveyIds.filter(() => readable === null || readable.has(actor.id)));

  const sweep = () =>
    runDataRetentionSweep({
      checkLicence: async () => true,
      sweepers: { responses: createResponsesSweeper(canRead) },
    });

  const addUser = async (
    email: string,
    role: "owner" | "manager" | "member" | "billing",
    isActive = true
  ) => {
    const user = await prisma.user.create({ data: { name: email, email, isActive, locale: "en-US" } });
    await prisma.membership.create({ data: { userId: user.id, organizationId, role, accepted: true } });
    return user.id;
  };

  const addResponses = (ages: number[], survey = surveyId) =>
    prisma.response.createMany({ data: ages.map((age) => ({ surveyId: survey, createdAt: ago(age) })) });

  const notice = () =>
    prisma.retentionNotice.findUnique({ where: { surveyId_entity: { surveyId, entity: "responses" } } });

  /** Moves the delivered reminder back in time, as if `days` had passed since it went out. */
  const ageNotice = (days: number) =>
    prisma.retentionNotice.update({
      where: { surveyId_entity: { surveyId, entity: "responses" } },
      data: { sentAt: ago(days), deliveredAt: ago(days) },
    });

  const runItems = () =>
    prisma.retentionRunItem.findMany({ orderBy: { run: { startedAt: "asc" } }, include: { run: true } });

  beforeEach(async () => {
    vi.clearAllMocks();
    await resetDb();
    readable = null;
    vi.mocked(sendSurveyRetentionNoticeEmail).mockResolvedValue(true);
    vi.mocked(deleteFile).mockResolvedValue({ ok: true, data: undefined } as never);
    vi.mocked(deleteSurveyUploadFolder).mockResolvedValue(true);

    organizationId = (await prisma.organization.create({ data: { name: "Acme" } })).id;
    workspaceId = (await prisma.workspace.create({ data: { name: "Europe", organizationId } })).id;
    await prisma.feedbackDirectory.create({ data: { name: "Main", organizationId } });
    ownerId = await addUser("owner@example.com", "member");
    surveyId = (await prisma.survey.create({ data: { name: "Site visit", workspaceId, ownerId } })).id;
    await prisma.retentionPolicy.create({
      data: {
        organizationId,
        entity: "responses",
        enabled: true,
        enabledAt: ago(1000),
        warnDays: WARN,
        periodDays: PERIOD,
      },
    });
  });

  test("first night: reminds the survey's owner once, and deletes nothing", async () => {
    await addResponses([400, 340, 10]);

    await sweep();

    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledOnce();
    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "owner@example.com",
        organizationName: "Acme",
        archivedSurveys: [],
        responseDeletions: [expect.objectContaining({ name: "Site visit", count: "2" })],
      })
    );
    expect(await prisma.response.count()).toBe(3);
    expect(await notice()).toMatchObject({ emailSent: true, deliveredAt: expect.any(Date) });
    expect(await runItems()).toEqual([
      expect.objectContaining({ action: "notified", targetId: surveyId, recipient: "owner@example.com" }),
    ]);

    // The next night sends nothing more: the reminder is still valid and its warning is running.
    await sweep();
    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledOnce();
    expect(await prisma.response.count()).toBe(3);
  });

  test("deletes only responses past the period, once the reminder has run its warning", async () => {
    await addResponses([400, 380, 340, 10]);
    await sweep();
    await ageNotice(WARN + 1);

    await sweep();

    const left = await prisma.response.findMany({ select: { createdAt: true } });
    expect(left).toHaveLength(2);
    expect(left.every((row) => row.createdAt > ago(PERIOD))).toBe(true);
    const deleted = (await runItems()).find((item) => item.action === "deleted");
    expect(deleted).toMatchObject({ targetId: surveyId, count: 2 });
    expect(deleted?.run).toMatchObject({ deletedCount: 2, hasChanges: true });
    // Hub records of the deleted responses are queued; the 340-day response keeps the reminder alive.
    const queued = await prisma.deletionCleanup.findMany({ where: { kind: "hubResponses" } });
    expect(queued).toHaveLength(1);
    expect(queued[0].responseIds).toHaveLength(2);
    expect(await notice()).not.toBeNull();
    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledOnce();
  });

  test("never deletes before a reminder was delivered", async () => {
    await addResponses([400, 390]);
    vi.mocked(sendSurveyRetentionNoticeEmail).mockRejectedValue(new Error("smtp down"));

    await sweep();
    // However long ago the undelivered claim was made.
    await prisma.retentionNotice.update({
      where: { surveyId_entity: { surveyId, entity: "responses" } },
      data: { sentAt: ago(WARN + 10) },
    });
    vi.mocked(sendSurveyRetentionNoticeEmail).mockRejectedValue(new Error("smtp still down"));
    await sweep();

    expect(await prisma.response.count()).toBe(2);
    expect(await notice()).toMatchObject({ deliveredAt: null });
    expect((await runItems()).filter((item) => item.action === "notified")).toEqual([]);
  });

  test("re-arms the reminder once nothing is left in the warning window", async () => {
    await addResponses([400, 380]);
    await sweep();
    await ageNotice(WARN + 1);

    await sweep();

    expect(await prisma.response.count()).toBe(0);
    expect(await notice()).toBeNull();
  });

  test("records a notice without SMTP as delivered with no recipient", async () => {
    await addResponses([400]);
    vi.mocked(sendSurveyRetentionNoticeEmail).mockResolvedValue(false);

    await sweep();

    expect(await notice()).toMatchObject({ emailSent: false, deliveredAt: expect.any(Date) });
    expect(await runItems()).toEqual([expect.objectContaining({ action: "notified", recipient: null })]);
  });

  test("holds an exempt survey: no reminder, no deletion, and a skip in History once", async () => {
    await addResponses([400]);
    await prisma.retentionExemption.create({
      data: { organizationId, entity: "responses", surveyId, until: ago(-30), reason: "Audit" },
    });

    await sweep();
    await sweep();

    expect(sendSurveyRetentionNoticeEmail).not.toHaveBeenCalled();
    expect(await prisma.response.count()).toBe(1);
    const items = await runItems();
    expect(items).toEqual([expect.objectContaining({ action: "skipped", skipReason: "exempt" })]);
    expect((await prisma.retentionRun.findMany()).map((run) => run.skippedCount)).toEqual([1, 1]);
  });

  test("an exemption created after the run read the survey stops its deletion", async () => {
    await addResponses([400, 380]);
    await sweep();
    await ageNotice(WARN + 1);
    const run = (await openRetentionRun(organizationId, "responses"))!;
    const cutoffs = getRetentionClockCutoffs(run.policy, run.now);
    const survey = (await prisma.survey.findUniqueOrThrow({ where: { id: surveyId } })) as never;
    await prisma.retentionExemption.create({
      data: { organizationId, entity: "responses", surveyId, until: ago(-30), reason: "Audit" },
    });

    await deleteDueResponses({ ...run, deadline: Date.now() + 60_000 }, survey, {
      noticeDueAtOrBefore: cutoffs.noticeDueAtOrBefore,
      actionDueAtOrBefore: cutoffs.actionDueAtOrBefore!,
    });

    expect(await prisma.response.count()).toBe(2);
  });

  test("re-checks under the lock that the reminder has run its full warning", async () => {
    await addResponses([400]);
    await sweep();
    // Delivered tonight: the responses are past the period, but the warning has only just started.
    const run = (await openRetentionRun(organizationId, "responses"))!;
    const cutoffs = getRetentionClockCutoffs(run.policy, run.now);

    await deleteDueResponses(
      { ...run, deadline: Date.now() + 60_000 },
      (await prisma.survey.findUniqueOrThrow({ where: { id: surveyId } })) as never,
      { noticeDueAtOrBefore: cutoffs.noticeDueAtOrBefore, actionDueAtOrBefore: cutoffs.actionDueAtOrBefore! }
    );

    expect(await prisma.response.count()).toBe(1);
  });

  test("a policy paused after the reminder stops its deletion", async () => {
    await addResponses([400]);
    await sweep();
    await ageNotice(WARN + 1);
    const run = (await openRetentionRun(organizationId, "responses"))!;
    const cutoffs = getRetentionClockCutoffs(run.policy, run.now);
    await updateRetentionPolicy({
      organizationId,
      policy: "responses",
      patch: { enabled: false },
      updatedById: ownerId,
    });

    await expect(
      deleteDueResponses(
        { ...run, deadline: Date.now() + 60_000 },
        (await prisma.survey.findUniqueOrThrow({ where: { id: surveyId } })) as never,
        {
          noticeDueAtOrBefore: cutoffs.noticeDueAtOrBefore,
          actionDueAtOrBefore: cutoffs.actionDueAtOrBefore!,
        }
      )
    ).rejects.toThrow("changed during the run");
    expect(await prisma.response.count()).toBe(1);
  });

  test("a reminder from before an exemption ended no longer counts: a new one is due first", async () => {
    await addResponses([400, 380]);
    await sweep();
    await ageNotice(WARN + 20);
    // Held from just after the reminder until yesterday.
    await prisma.retentionExemption.create({
      data: { organizationId, entity: "responses", surveyId, until: ago(1), reason: "Audit" },
    });

    await sweep();

    expect(await prisma.response.count()).toBe(2);
    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledTimes(2);
  });

  test("an exemption revoked after the run opened voids the reminder: a new one, and no deletion", async () => {
    await addResponses([400, 380]);
    await sweep();
    await ageNotice(WARN + 1);
    // Revoked a moment from now, as if during tonight's run, after the run read its clock.
    await prisma.retentionExemption.create({
      data: {
        organizationId,
        entity: "responses",
        surveyId,
        until: ago(-30),
        revokedAt: new Date(Date.now() + 60_000),
        reason: "Audit",
      },
    });

    await sweep();

    expect(await prisma.response.count()).toBe(2);
    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledTimes(2);
  });

  test("re-arms the reminder when the responses left the window some other way", async () => {
    await addResponses([400]);
    await sweep();
    await prisma.response.deleteMany();

    await sweep();

    expect(await notice()).toBeNull();
  });

  test("one email a night per person, listing both their responses reminders and survey notices", async () => {
    await addResponses([400]);
    const stale = (await prisma.survey.create({ data: { name: "Old feedback", workspaceId, ownerId } })).id;
    await prisma.$executeRaw`UPDATE "Survey" SET "created_at" = ${ago(400)}, "updated_at" = ${ago(400)} WHERE "id" = ${stale}`;
    await prisma.retentionPolicy.create({
      data: {
        organizationId,
        entity: "surveys",
        enabled: true,
        enabledAt: ago(1000),
        warnDays: WARN,
        periodDays: PERIOD,
        conditions: ["noChange"],
      },
    });

    await runDataRetentionSweep({
      checkLicence: async () => true,
      sweepers: { responses: createResponsesSweeper(canRead), surveys: createSurveysSweeper(canRead) },
    });

    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledOnce();
    expect(vi.mocked(sendSurveyRetentionNoticeEmail).mock.calls[0][0]).toMatchObject({
      responseDeletions: [expect.objectContaining({ name: "Site visit" })],
      archivedSurveys: [expect.objectContaining({ name: "Old feedback" })],
    });
    // Each notice is recorded on its own policy's run.
    const notified = await prisma.retentionRunItem.findMany({
      where: { action: "notified" },
      include: { run: true },
    });
    expect(notified.map((item) => [item.run.entity, item.targetId]).sort()).toEqual(
      [
        ["responses", surveyId],
        ["surveys", stale],
      ].sort()
    );
  });

  describe("who is told", () => {
    test("falls back from an owner who can't read the survey to its creator", async () => {
      const creatorId = await addUser("creator@example.com", "member");
      await prisma.survey.update({ where: { id: surveyId }, data: { createdBy: creatorId } });
      readable = new Set([creatorId]);
      await addResponses([400]);

      await sweep();

      expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledWith(
        expect.objectContaining({ email: "creator@example.com" })
      );
    });

    test("falls back to an organisation owner, never to an inactive or billing member", async () => {
      await prisma.user.update({ where: { id: ownerId }, data: { isActive: false } });
      await addUser("billing@example.com", "billing");
      await addUser("manager@example.com", "manager");
      await addUser("boss@example.com", "owner");
      await addResponses([400]);

      await sweep();

      expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledWith(
        expect.objectContaining({ email: "boss@example.com" })
      );
    });

    test("skips a survey nobody eligible can be told about, claiming nothing", async () => {
      readable = new Set();
      await addResponses([400]);

      await sweep();

      expect(sendSurveyRetentionNoticeEmail).not.toHaveBeenCalled();
      expect(await notice()).toBeNull();
      expect(await runItems()).toEqual([
        expect.objectContaining({ action: "skipped", skipReason: "noRecipient" }),
      ]);
    });

    test("checks a prolific owner's surveys in bulk calls the authorization service accepts", async () => {
      const surveyIds = [surveyId];
      for (let i = 0; i < 260; i += 1) {
        surveyIds.push((await prisma.survey.create({ data: { name: `S${i}`, workspaceId, ownerId } })).id);
      }
      await prisma.response.createMany({
        data: surveyIds.map((id) => ({ surveyId: id, createdAt: ago(400) })),
      });
      const sizes: number[] = [];
      const bulkCheck = async (_actor: unknown, ids: ReadonlyArray<string>) => {
        sizes.push(ids.length);
        if (ids.length > 250) throw new Error("INVALID_REQUEST: too many items");
        return new Set(ids);
      };

      await runDataRetentionSweep({
        checkLicence: async () => true,
        sweepers: { responses: createResponsesSweeper(bulkCheck) },
      });

      expect(Math.max(...sizes)).toBeLessThanOrEqual(250);
      expect(vi.mocked(sendSurveyRetentionNoticeEmail).mock.calls[0][0].responseDeletions).toHaveLength(261);
    });

    test("sends one email per person, listing all of their surveys", async () => {
      const second = (await prisma.survey.create({ data: { name: "NPS", workspaceId, ownerId } })).id;
      await addResponses([400]);
      await addResponses([400], second);

      await sweep();

      expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledOnce();
      expect(vi.mocked(sendSurveyRetentionNoticeEmail).mock.calls[0][0].responseDeletions).toHaveLength(2);
    });
  });

  describe("with the surveys policy on too", () => {
    const bothSweep = () =>
      runDataRetentionSweep({
        checkLicence: async () => true,
        sweepers: { responses: createResponsesSweeper(canRead), surveys: createSurveysSweeper(canRead) },
      });

    const enableSurveysPolicy = (enabled = true) =>
      prisma.retentionPolicy.create({
        data: {
          organizationId,
          entity: "surveys",
          enabled,
          enabledAt: enabled ? ago(1000) : null,
          warnDays: WARN,
          periodDays: PERIOD,
          conditions: ["noResponse", "noChange"],
        },
      });

    /** The survey last edited `days` ago, written raw: Prisma would stamp `updated_at` with now. */
    const editedAgo = (days: number) =>
      prisma.$executeRaw`UPDATE "Survey" SET "created_at" = ${ago(days)}, "updated_at" = ${ago(days)} WHERE "id" = ${surveyId}`;

    const surveysNotice = () =>
      prisma.retentionNotice.findUnique({ where: { surveyId_entity: { surveyId, entity: "surveys" } } });

    const ageNotices = (days: number) =>
      prisma.retentionNotice.updateMany({
        where: { surveyId },
        data: { sentAt: ago(days), deliveredAt: ago(days) },
      });

    const surveyUpdatedAt = async () =>
      (await prisma.survey.findUniqueOrThrow({ where: { id: surveyId } })).updatedAt;

    const isArchived = async () =>
      (await prisma.survey.findUniqueOrThrow({ where: { id: surveyId } })).archivedAt !== null;

    test("deleting a survey's last responses keeps its archive notice: one email, then both actions", async () => {
      await enableSurveysPolicy();
      await addResponses([390, 380]);
      await editedAgo(400);

      await bothSweep();
      expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledOnce();
      expect(vi.mocked(sendSurveyRetentionNoticeEmail).mock.calls[0][0]).toMatchObject({
        responseDeletions: [expect.objectContaining({ name: "Site visit" })],
        archivedSurveys: [expect.objectContaining({ name: "Site visit" })],
      });

      const lastEdit = await surveyUpdatedAt();
      await ageNotices(WARN + 1);
      await bothSweep();

      expect(await prisma.response.count()).toBe(0);
      expect(await isArchived()).toBe(true);
      expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledOnce();
      // Re-stamped for the clock the deletion left: the last edit (the archive itself stamps a new one).
      expect((await surveysNotice())?.clockAt).toEqual(lastEdit);
    });

    test("a person deleting the newest response voids the archive notice: a new one, and a full warning", async () => {
      await enableSurveysPolicy();
      await addResponses([400, 370]);
      await editedAgo(420);
      await bothSweep();
      expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledOnce();

      // Someone deletes the newest response in the app: the survey's clock falls back to the older one.
      const newest = await prisma.response.findFirstOrThrow({
        where: { surveyId },
        orderBy: { createdAt: "desc" },
      });
      await prisma.response.delete({ where: { id: newest.id } });
      // The archive notice's warning has run; the responses reminder's hasn't, so nothing is deleted.
      await prisma.retentionNotice.update({
        where: { surveyId_entity: { surveyId, entity: "surveys" } },
        data: { sentAt: ago(WARN + 1), deliveredAt: ago(WARN + 1) },
      });

      await bothSweep();
      expect(await isArchived()).toBe(false);
      expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledTimes(2);
      expect(vi.mocked(sendSurveyRetentionNoticeEmail).mock.calls[1][0]).toMatchObject({
        archivedSurveys: [expect.objectContaining({ name: "Site visit" })],
        responseDeletions: [],
      });
      // Computed for the clock the survey has now: the response that is left.
      const left = await prisma.response.findFirstOrThrow({ where: { surveyId } });
      expect((await surveysNotice())?.clockAt).toEqual(left.createdAt);

      // Its warning starts again from the new notice.
      await bothSweep();
      expect(await isArchived()).toBe(false);
      await prisma.retentionNotice.update({
        where: { surveyId_entity: { surveyId, entity: "surveys" } },
        data: { sentAt: ago(WARN + 1), deliveredAt: ago(WARN + 1) },
      });
      await bothSweep();
      expect(await isArchived()).toBe(true);
      expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledTimes(2);
    });

    /** The surveys policy's notice, delivered and computed for `clockAt`. */
    const storeSurveysNotice = (survey: string, clockAt: Date) =>
      prisma.retentionNotice.create({
        data: {
          organizationId,
          entity: "surveys",
          surveyId: survey,
          sentAt: ago(5),
          deliveredAt: ago(5),
          clockAt,
        },
      });

    const clockAtOf = async (survey: string) =>
      (
        await prisma.retentionNotice.findUniqueOrThrow({
          where: { surveyId_entity: { surveyId: survey, entity: "surveys" } },
        })
      ).clockAt;

    /** The responses policy alone: its reminder, then its deletions once the warning has run. */
    const remindThenDelete = async () => {
      await sweep();
      await prisma.retentionNotice.updateMany({
        where: { entity: "responses" },
        data: { sentAt: ago(WARN + 1), deliveredAt: ago(WARN + 1) },
      });
      await sweep();
    };

    test("re-stamps a notice computed for the clock before the deletion, and clears any other for good", async () => {
      await enableSurveysPolicy();
      const other = (await prisma.survey.create({ data: { name: "NPS", workspaceId, ownerId } })).id;
      for (const id of [surveyId, other]) {
        await prisma.response.create({ data: { surveyId: id, createdAt: ago(380) } });
        await prisma.$executeRaw`UPDATE "Survey" SET "created_at" = ${ago(400)}, "updated_at" = ${ago(400)} WHERE "id" = ${id}`;
      }
      const [{ createdAt: newest }] = await prisma.response.findMany({ where: { surveyId } });
      await storeSurveysNotice(surveyId, newest);
      // Computed for a clock the survey no longer had: already void.
      const stale = ago(390);
      await storeSurveysNotice(other, stale);

      await remindThenDelete();

      expect(await prisma.response.count()).toBe(0);
      expect(await clockAtOf(surveyId)).toEqual(await surveyUpdatedAt());
      // Already void, and cleared, so the clock the deletion leaves can never make it count again.
      expect(await clockAtOf(other)).toBeNull();
    });

    test("an older response deleted under a newer one leaves a void notice void", async () => {
      await enableSurveysPolicy();
      await addResponses([380, 340]);
      await editedAgo(400);
      const [older, newer] = await prisma.response.findMany({
        where: { surveyId },
        orderBy: { createdAt: "asc" },
      });
      // Computed while the older response was the newest: void since the newer one came in.
      await storeSurveysNotice(surveyId, older.createdAt);

      await remindThenDelete();

      expect(await prisma.response.findMany({ where: { surveyId }, select: { id: true } })).toEqual([
        { id: newer.id },
      ]);
      // The clock didn't move (it is still the newer response), and the notice isn't brought back to it.
      expect(await clockAtOf(surveyId)).toEqual(older.createdAt);
    });

    describe("a notice voided by a newer response stays void once that response is deleted", () => {
      const surveysNoticeUpdate = (data: { sentAt: Date; deliveredAt: Date }) =>
        prisma.retentionNotice.update({ where: { surveyId_entity: { surveyId, entity: "surveys" } }, data });

      const archiveNoticesSent = () =>
        vi
          .mocked(sendSurveyRetentionNoticeEmail)
          .mock.calls.filter(([email]) => email.archivedSurveys.length > 0).length;

      /**
       * A survey last edited long ago is warned, and its warning runs out; a response then comes in, which
       * voids the notice. Returns that response.
       */
      const warnedThenAnswered = async () => {
        await enableSurveysPolicy();
        await editedAgo(400);
        await bothSweep();
        expect(archiveNoticesSent()).toBe(1);
        expect((await surveysNotice())?.clockAt).toEqual(await surveyUpdatedAt());
        await surveysNoticeUpdate({ sentAt: ago(100), deliveredAt: ago(100) });
        return prisma.response.create({ data: { surveyId, createdAt: ago(70) } });
      };

      /** After the deletion: no archive on the old notice, a fresh one, and the archive a full warning later. */
      const expectFreshWarning = async () => {
        await bothSweep();
        expect(await isArchived()).toBe(false);
        expect(archiveNoticesSent()).toBe(2);

        await bothSweep();
        expect(await isArchived()).toBe(false);
        await surveysNoticeUpdate({ sentAt: ago(WARN + 1), deliveredAt: ago(WARN + 1) });
        await bothSweep();
        expect(await isArchived()).toBe(true);
        expect(archiveNoticesSent()).toBe(2);
      };

      test("when the responses policy deletes it", async () => {
        const response = await warnedThenAnswered();
        await prisma.retentionPolicy.update({
          where: { organizationId_entity: { organizationId, entity: "responses" } },
          data: { periodDays: 60 },
        });
        // The response gets its reminder; once that has run its warning, the policy deletes it.
        await bothSweep();
        expect(await isArchived()).toBe(false);
        await prisma.retentionNotice.update({
          where: { surveyId_entity: { surveyId, entity: "responses" } },
          data: { sentAt: ago(WARN + 1), deliveredAt: ago(WARN + 1) },
        });
        await bothSweep();
        expect(await prisma.response.findUnique({ where: { id: response.id } })).toBeNull();
        expect(await isArchived()).toBe(false);
        expect(await clockAtOf(surveyId)).toBeNull();

        await expectFreshWarning();
      });

      test("when a person deletes it", async () => {
        const response = await warnedThenAnswered();
        await bothSweep();
        expect(await isArchived()).toBe(false);

        await prisma.response.delete({ where: { id: response.id } });
        expect(await clockAtOf(surveyId)).toBeNull();

        await expectFreshWarning();
      });

      test("when its creation date is moved back before the notice's clock", async () => {
        const response = await warnedThenAnswered();
        await bothSweep();
        expect(await isArchived()).toBe(false);

        // The management API accepts a response's createdAt: back before the last edit, the clock is the
        // last edit again, the very one the notice was computed for.
        await prisma.response.update({ where: { id: response.id }, data: { createdAt: ago(500) } });
        expect(await clockAtOf(surveyId)).toBeNull();

        await expectFreshWarning();
      });
    });

    test("does nothing to a survey's notice when the surveys policy is off", async () => {
      await enableSurveysPolicy(false);
      await addResponses([380]);
      await editedAgo(400);
      const [{ createdAt: newest }] = await prisma.response.findMany({ where: { surveyId } });
      await storeSurveysNotice(surveyId, newest);

      await remindThenDelete();

      expect(await prisma.response.count()).toBe(0);
      expect(await clockAtOf(surveyId)).toEqual(newest);
    });

    describe("a person's deletion or move of a response (the void triggers)", () => {
      test("voids the archive notice of every survey a delete takes a response from, whichever response", async () => {
        const other = (await prisma.survey.create({ data: { name: "NPS", workspaceId, ownerId } })).id;
        await addResponses([400, 380]);
        await addResponses([400], other);
        const [oldest] = await prisma.response.findMany({
          where: { surveyId },
          orderBy: { createdAt: "asc" },
        });
        const otherClock = ago(400);
        await storeSurveysNotice(surveyId, ago(380));
        await storeSurveysNotice(other, otherClock);

        // Not even the newest: the survey changed, so its owner is warned again. Other surveys keep theirs.
        await prisma.response.delete({ where: { id: oldest.id } });
        expect(await clockAtOf(surveyId)).toBeNull();
        expect(await clockAtOf(other)).toEqual(otherClock);

        await prisma.response.deleteMany({ where: { surveyId: other } });
        expect(await clockAtOf(other)).toBeNull();
      });

      test("leaves the responses policy's own deletes alone, and only inside its transaction", async () => {
        await addResponses([400, 380]);
        const kept = ago(380);
        await storeSurveysNotice(surveyId, kept);
        const [first, second] = await prisma.response.findMany({ where: { surveyId } });

        const backendPid = async (tx: Pick<typeof prisma, "$queryRaw">) =>
          (await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS "pid"`)[0].pid;

        let flaggedPid = 0;
        await prisma.$transaction(async (tx) => {
          flaggedPid = await backendPid(tx);
          await markRetentionPolicyDelete(tx);
          await tx.response.delete({ where: { id: first.id } });
        });
        expect(await clockAtOf(surveyId)).toEqual(kept);

        // The flag ended with that transaction: a person's delete on the very same connection voids it.
        // The pool hands out its connections in turn, so try until that one comes back.
        let sameConnection = false;
        for (let attempt = 0; attempt < 50 && !sameConnection; attempt += 1) {
          await prisma.$transaction(async (tx) => {
            if ((await backendPid(tx)) !== flaggedPid) return;
            sameConnection = true;
            await tx.response.delete({ where: { id: second.id } });
          });
        }
        expect(sameConnection).toBe(true);
        expect(await clockAtOf(surveyId)).toBeNull();
      });

      test("a contact deleted with its responses voids their surveys' archive notices", async () => {
        const contact = await prisma.contact.create({ data: { workspaceId } });
        await prisma.response.create({ data: { surveyId, contactId: contact.id, createdAt: ago(380) } });
        await storeSurveysNotice(surveyId, ago(380));

        await prisma.contact.delete({ where: { id: contact.id } });

        expect(await prisma.response.count()).toBe(0);
        expect(await clockAtOf(surveyId)).toBeNull();
      });

      test("a response moved to another survey voids both surveys' archive notices", async () => {
        const other = (await prisma.survey.create({ data: { name: "NPS", workspaceId, ownerId } })).id;
        await addResponses([380]);
        await storeSurveysNotice(surveyId, ago(380));
        await storeSurveysNotice(other, ago(400));
        const [response] = await prisma.response.findMany({ where: { surveyId } });

        // An update that touches neither column leaves them alone.
        await prisma.response.update({ where: { id: response.id }, data: { finished: true } });
        expect(await clockAtOf(surveyId)).not.toBeNull();

        await prisma.response.update({ where: { id: response.id }, data: { surveyId: other } });
        expect(await clockAtOf(surveyId)).toBeNull();
        expect(await clockAtOf(other)).toBeNull();
      });

      test("deleting a survey takes its responses and notices without an error", async () => {
        await addResponses([400, 380]);
        await storeSurveysNotice(surveyId, ago(380));

        await prisma.survey.delete({ where: { id: surveyId } });

        expect(await prisma.response.count()).toBe(0);
        expect(await prisma.retentionNotice.count()).toBe(0);
      });
    });
  });
});
