import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { sendSurveyRetentionNoticeEmail } from "@/modules/email";
import { deleteFile, deleteSurveyUploadFolder } from "@/modules/storage/service";
import { updateRetentionPolicy } from "../lib/policies-service";
import { getRetentionClockCutoffs } from "../lib/schedule";
import { createResponsesSweeper, deleteDueResponses } from "./responses-sweeper";
import { openRetentionRun } from "./run";
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
});
