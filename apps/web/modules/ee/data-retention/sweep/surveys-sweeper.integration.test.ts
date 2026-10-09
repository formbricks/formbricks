import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { RetentionSurveyCondition } from "@formbricks/database/prisma";
import { resetDb } from "@/integration/reset-db";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { sendSurveyRetentionNoticeEmail } from "@/modules/email";
import { getRetentionClockCutoffs } from "../lib/schedule";
import { openRetentionRun } from "./run";
import { sendSurveyNotices } from "./survey-notices";
import { archiveDueSurvey, createSurveysSweeper } from "./surveys-sweeper";
import { runDataRetentionSweep } from "./sweep";

vi.mock("@/modules/email", () => ({ sendSurveyRetentionNoticeEmail: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventWithoutRequest: vi.fn().mockResolvedValue(undefined),
}));

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const WARN = 30;
const PERIOD = 365;

/** A survey's timestamps are written raw: Prisma would stamp `updated_at` with now. */
const setSurveyTimes = (surveyId: string, { createdAt, updatedAt }: { createdAt: Date; updatedAt: Date }) =>
  prisma.$executeRaw`UPDATE "Survey" SET "created_at" = ${createdAt}, "updated_at" = ${updatedAt} WHERE "id" = ${surveyId}`;

describe("surveys sweeper (real Postgres)", () => {
  let organizationId: string;
  let workspaceId: string;
  let ownerId: string;

  const sweep = () =>
    runDataRetentionSweep({
      checkLicence: async () => true,
      sweepers: { surveys: createSurveysSweeper(async (_actor, ids) => new Set(ids)) },
    });

  const createSurvey = async (
    name: string,
    { age, status }: { age: number; status?: "inProgress" | "draft" }
  ) => {
    const id = (
      await prisma.survey.create({ data: { name, workspaceId, ownerId, status: status ?? "inProgress" } })
    ).id;
    await setSurveyTimes(id, { createdAt: ago(age), updatedAt: ago(age) });
    return id;
  };

  const enablePolicy = (conditions: RetentionSurveyCondition[]) =>
    prisma.retentionPolicy.create({
      data: {
        organizationId,
        entity: "surveys",
        enabled: true,
        enabledAt: ago(1000),
        warnDays: WARN,
        periodDays: PERIOD,
        conditions,
      },
    });

  const notice = (surveyId: string) =>
    prisma.retentionNotice.findUnique({ where: { surveyId_entity: { surveyId, entity: "surveys" } } });

  const ageNotice = (surveyId: string, days: number) =>
    prisma.retentionNotice.update({
      where: { surveyId_entity: { surveyId, entity: "surveys" } },
      data: { sentAt: ago(days), deliveredAt: ago(days) },
    });

  beforeEach(async () => {
    vi.clearAllMocks();
    await resetDb();
    vi.mocked(sendSurveyRetentionNoticeEmail).mockResolvedValue(true);
    organizationId = (await prisma.organization.create({ data: { name: "Acme" } })).id;
    workspaceId = (await prisma.workspace.create({ data: { name: "Europe", organizationId } })).id;
    ownerId = (await prisma.user.create({ data: { name: "Ada", email: "ada@example.com" } })).id;
    await prisma.membership.create({
      data: { userId: ownerId, organizationId, role: "member", accepted: true },
    });
  });

  test("notifies, then archives after the full warning, pausing a live survey", async () => {
    await enablePolicy(["noChange"]);
    const stale = await createSurvey("Old feedback", { age: 400 });
    const fresh = await createSurvey("New feedback", { age: 10 });

    await sweep();

    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledOnce();
    expect(vi.mocked(sendSurveyRetentionNoticeEmail).mock.calls[0][0]).toMatchObject({
      archivedSurveys: [expect.objectContaining({ name: "Old feedback" })],
      responseDeletions: [],
    });
    expect((await prisma.survey.findUniqueOrThrow({ where: { id: stale } })).archivedAt).toBeNull();

    await ageNotice(stale, WARN + 1);
    await sweep();

    const archived = await prisma.survey.findUniqueOrThrow({ where: { id: stale } });
    expect(archived).toMatchObject({ archivedAt: expect.any(Date), status: "paused" });
    expect((await prisma.survey.findUniqueOrThrow({ where: { id: fresh } })).archivedAt).toBeNull();
    expect(queueAuditEventWithoutRequest).toHaveBeenCalledWith(
      expect.objectContaining({ action: "archived", targetId: stale, userType: "system" })
    );
    const items = await prisma.retentionRunItem.findMany({ orderBy: { run: { startedAt: "asc" } } });
    expect(items.map((item) => item.action)).toEqual(["notified", "archived"]);
  });

  test("a survey changed between the sweep's read and its claim gets a void notice, and a new one before any archive", async () => {
    await enablePolicy(["noChange"]);
    const stale = await createSurvey("Old feedback", { age: 400 });
    // The sweep reads the survey as untouched for 400 days and plans its notice from that clock...
    const run = (await openRetentionRun(organizationId, "surveys"))!;
    const plan = await createSurveysSweeper(async (_actor, ids) => new Set(ids))({
      ...run,
      deadline: Date.now() + 60_000,
    });
    // ...then the survey is edited before the notice is claimed. Still old enough to be due, so the
    // email's date can't be told apart from a valid one, but it was computed from the old clock.
    await setSurveyTimes(stale, { createdAt: ago(400), updatedAt: ago(380) });
    await sendSurveyNotices(organizationId, [plan.surveyNotices!], Date.now() + 60_000);
    await prisma.retentionRun.update({ where: { id: run.runId }, data: { finishedAt: new Date() } });
    const raced = (await notice(stale))!;
    expect(raced.deliveredAt).not.toBeNull();
    // Stamped with the clock the sweep read (400 days), not the one the survey has now (380).
    expect(raced.clockAt!.getTime()).toBeLessThan(ago(399).getTime());

    // Its warning has run, but it was given for a clock the survey no longer has: no archive, a new
    // notice for the survey's clock now.
    await ageNotice(stale, WARN + 1);
    await sweep();

    expect((await prisma.survey.findUniqueOrThrow({ where: { id: stale } })).archivedAt).toBeNull();
    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledTimes(2);
    expect((await notice(stale))?.clockAt?.getTime()).toBe(
      (await prisma.survey.findUniqueOrThrow({ where: { id: stale } })).updatedAt.getTime()
    );
  });

  test("a recent response keeps a survey under 'no response'; it doesn't count without that condition", async () => {
    const answered = await createSurvey("Answered", { age: 400 });
    await prisma.response.create({ data: { surveyId: answered, createdAt: ago(5) } });
    await setSurveyTimes(answered, { createdAt: ago(400), updatedAt: ago(400) });

    await enablePolicy(["noResponse", "noChange"]);
    await sweep();
    expect(sendSurveyRetentionNoticeEmail).not.toHaveBeenCalled();

    await prisma.retentionPolicy.update({
      where: { organizationId_entity: { organizationId, entity: "surveys" } },
      data: { conditions: ["noChange"] },
    });
    await sweep();
    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledOnce();
  });

  test("activity after the notice moves the clock: the survey is not archived", async () => {
    await enablePolicy(["noChange"]);
    const survey = await createSurvey("Old feedback", { age: 400 });
    await sweep();
    await ageNotice(survey, WARN + 1);
    // Edited a moment ago: the clock moved past the notice.
    await setSurveyTimes(survey, { createdAt: ago(400), updatedAt: ago(1) });

    await sweep();

    expect((await prisma.survey.findUniqueOrThrow({ where: { id: survey } })).archivedAt).toBeNull();
    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledOnce();
  });

  test("an exemption on either policy holds the survey, and History shows the skip once", async () => {
    await enablePolicy(["noChange"]);
    const survey = await createSurvey("Old feedback", { age: 400 });
    await prisma.retentionExemption.create({
      data: { organizationId, entity: "responses", surveyId: survey, until: ago(-30), reason: "Audit" },
    });

    await sweep();
    await sweep();

    expect(sendSurveyRetentionNoticeEmail).not.toHaveBeenCalled();
    expect(await prisma.retentionRunItem.findMany()).toEqual([
      expect.objectContaining({ action: "skipped", skipReason: "exempt", targetId: survey }),
    ]);
  });

  test("an exemption revoked after the run opened voids the notice: no archive", async () => {
    await enablePolicy(["noChange"]);
    const survey = await createSurvey("Old feedback", { age: 400 });
    await sweep();
    await ageNotice(survey, WARN + 1);
    await prisma.retentionExemption.create({
      data: {
        organizationId,
        entity: "surveys",
        surveyId: survey,
        until: ago(-30),
        revokedAt: new Date(Date.now() + 60_000),
        reason: "Audit",
      },
    });

    await sweep();

    expect((await prisma.survey.findUniqueOrThrow({ where: { id: survey } })).archivedAt).toBeNull();
    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledTimes(2);
  });

  test("a notice from before the survey's clock last moved is void and replaced", async () => {
    await enablePolicy(["noChange"]);
    const survey = await createSurvey("Old feedback", { age: 400 });
    await sweep();
    // The notice went out long ago, and the survey was edited after it (still long enough ago to be due).
    await ageNotice(survey, 395);
    await setSurveyTimes(survey, { createdAt: ago(400), updatedAt: ago(380) });

    await sweep();

    expect((await prisma.survey.findUniqueOrThrow({ where: { id: survey } })).archivedAt).toBeNull();
    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledTimes(2);
  });

  test("'created before' holds back a survey created within the period, however old its last edit", async () => {
    await enablePolicy(["noChange", "createdBefore"]);
    const recent = await createSurvey("Recent", { age: 400 });
    await setSurveyTimes(recent, { createdAt: ago(100), updatedAt: ago(400) });
    const old = await createSurvey("Old", { age: 400 });

    await sweep();

    expect(vi.mocked(sendSurveyRetentionNoticeEmail).mock.calls[0][0].archivedSurveys).toEqual([
      expect.objectContaining({ name: "Old" }),
    ]);
    expect(await notice(recent)).toBeNull();
    expect(await notice(old)).not.toBeNull();
  });

  test("leaves a survey scheduled to launch later alone", async () => {
    await enablePolicy(["noChange"]);
    const scheduled = await createSurvey("Launches soon", { age: 400 });
    await prisma.$executeRaw`UPDATE "Survey" SET "publishOn" = ${ago(-10)} WHERE "id" = ${scheduled}`;

    await sweep();

    expect(sendSurveyRetentionNoticeEmail).not.toHaveBeenCalled();
  });

  test("skips a survey nobody eligible can be told about", async () => {
    await enablePolicy(["noChange"]);
    const survey = await createSurvey("Old feedback", { age: 400 });

    await runDataRetentionSweep({
      checkLicence: async () => true,
      sweepers: { surveys: createSurveysSweeper(async () => new Set()) },
    });

    expect(sendSurveyRetentionNoticeEmail).not.toHaveBeenCalled();
    expect(await notice(survey)).toBeNull();
    expect(await prisma.retentionRunItem.findMany()).toEqual([
      expect.objectContaining({ action: "skipped", skipReason: "noRecipient", targetId: survey }),
    ]);
  });

  test("leaves a survey archived by hand to the purge", async () => {
    await enablePolicy(["noChange"]);
    const survey = await createSurvey("Old feedback", { age: 400 });
    await prisma.$executeRaw`UPDATE "Survey" SET "archivedAt" = ${ago(5)} WHERE "id" = ${survey}`;

    await sweep();

    expect(sendSurveyRetentionNoticeEmail).not.toHaveBeenCalled();
    expect(await notice(survey)).toBeNull();
  });

  test("re-checks under the lock: an exemption or an edit after the run read the survey stops the archive", async () => {
    await enablePolicy(["noChange"]);
    const held = await createSurvey("Held", { age: 400 });
    const edited = await createSurvey("Edited", { age: 400 });
    await sweep();
    await ageNotice(held, WARN + 1);
    await ageNotice(edited, WARN + 1);
    const run = (await openRetentionRun(organizationId, "surveys"))!;
    const { noticeDueAtOrBefore } = getRetentionClockCutoffs(run.policy, run.now);
    await prisma.retentionExemption.create({
      data: { organizationId, entity: "surveys", surveyId: held, until: ago(-30), reason: "Audit" },
    });
    await setSurveyTimes(edited, { createdAt: ago(400), updatedAt: ago(0) });

    const context = { ...run, deadline: Date.now() + 60_000 };
    await expect(archiveDueSurvey(context, held, noticeDueAtOrBefore)).resolves.toBe(false);
    await expect(archiveDueSurvey(context, edited, noticeDueAtOrBefore)).resolves.toBe(false);
    expect(await prisma.survey.count({ where: { archivedAt: { not: null } } })).toBe(0);
  });

  test("re-checks under the lock that the notice has run its full warning", async () => {
    await enablePolicy(["noChange"]);
    const survey = await createSurvey("Old feedback", { age: 400 });
    await sweep();
    const run = (await openRetentionRun(organizationId, "surveys"))!;
    const { noticeDueAtOrBefore } = getRetentionClockCutoffs(run.policy, run.now);

    await expect(
      archiveDueSurvey({ ...run, deadline: Date.now() + 60_000 }, survey, noticeDueAtOrBefore)
    ).resolves.toBe(false);
  });
});
