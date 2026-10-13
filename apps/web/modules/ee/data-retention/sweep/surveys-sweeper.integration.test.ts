import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma, type RetentionSurveyCondition } from "@formbricks/database/prisma";
import { resetDb } from "@/integration/reset-db";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { sendSurveyRetentionNoticeEmail } from "@/modules/email";
import { restoreSurvey } from "@/modules/survey/lib/surveys";
import { getRetentionClockCutoffs } from "../lib/schedule";
import { openRetentionRun } from "./run";
import { sendSurveyNotices } from "./survey-notices";
import { archiveDueSurvey, createSurveysSweeper } from "./surveys-sweeper";
import { runDataRetentionSweep } from "./sweep";

// Per-run caps a test can shrink; read through getters, so the sweep sees the current value.
const caps = vi.hoisted(() => ({ notices: 0, actions: 0 }));
vi.mock("./constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./constants")>();
  return {
    ...actual,
    get RETENTION_NOTICES_PER_RUN() {
      return caps.notices || actual.RETENTION_NOTICES_PER_RUN;
    },
    get RETENTION_ACTIONS_PER_RUN() {
      return caps.actions || actual.RETENTION_ACTIONS_PER_RUN;
    },
  };
});
vi.mock("@/modules/email", () => ({ sendSurveyRetentionNoticeEmail: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventWithoutRequest: vi.fn().mockResolvedValue(undefined),
}));

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const WARN = 30;
const PERIOD = 365;
/** How far past its boundary a step that should be due goes, against host/database clock drift. */
const CLOCK_MARGIN_MINUTES = 10;

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

  /**
   * As if `days` (and `minutes`) went by for this survey: its clocks (its timestamps, its responses and
   * its last restore) and its notice move that far into the past.
   */
  const travel = async (surveyId: string, days: number, minutes = 0) => {
    const by = Prisma.sql`make_interval(days => ${days}::int, mins => ${minutes}::int)`;
    await prisma.$executeRaw`
      UPDATE "Survey" SET "created_at" = "created_at" - ${by}, "updated_at" = "updated_at" - ${by}
      WHERE "id" = ${surveyId}`;
    await prisma.$executeRaw`
      UPDATE "Response" SET "created_at" = "created_at" - ${by} WHERE "surveyId" = ${surveyId}`;
    await prisma.$executeRaw`
      UPDATE "RetentionSurveyRestore" SET "restoredAt" = "restoredAt" - ${by} WHERE "surveyId" = ${surveyId}`;
    await prisma.$executeRaw`
      UPDATE "RetentionNotice"
      SET "sentAt" = "sentAt" - ${by}, "deliveredAt" = "deliveredAt" - ${by}, "clockAt" = "clockAt" - ${by}
      WHERE "surveyId" = ${surveyId}`;
  };

  /** History's record that the surveys policy archived it (what lets a restore start its period over). */
  const recordPolicyArchive = async (surveyId: string) => {
    const run = await prisma.retentionRun.create({
      data: { organizationId, entity: "surveys", startedAt: ago(1), finishedAt: ago(1) },
    });
    await prisma.retentionRunItem.create({
      data: { runId: run.id, targetType: "survey", targetId: surveyId, action: "archived" },
    });
  };

  /** What the runs did, skips aside: History's rows that changed something. */
  const actions = async () =>
    (
      await prisma.retentionRunItem.findMany({
        where: { action: { not: "skipped" } },
        orderBy: [{ run: { startedAt: "asc" } }, { id: "asc" }],
      })
    ).map((item) => [item.action, item.targetId]);

  const latestRun = () => prisma.retentionRun.findFirstOrThrow({ orderBy: { startedAt: "desc" } });

  const isArchived = async (surveyId: string) =>
    (await prisma.survey.findUniqueOrThrow({ where: { id: surveyId } })).archivedAt !== null;

  beforeEach(async () => {
    vi.clearAllMocks();
    caps.notices = 0;
    caps.actions = 0;
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

  // Decided 13 Oct (Tiago): each condition reads only its own date, so an unticked one never holds a
  // survey back; ticked together, all must hold.
  describe("each condition decides on its own date, and only ticked ones count", () => {
    const fixtures = async () => {
      const survey = async (
        name: string,
        { created, updated, answered }: { created: number; updated: number; answered?: number }
      ) => {
        const id = await createSurvey(name, { age: created });
        if (answered !== undefined) {
          await prisma.response.create({ data: { surveyId: id, createdAt: ago(answered) } });
        }
        await setSurveyTimes(id, { createdAt: ago(created), updatedAt: ago(updated) });
        return [name, id] as const;
      };
      return Object.fromEntries([
        await survey("Edited lately", { created: 400, updated: 5 }),
        await survey("Answered lately", { created: 400, updated: 400, answered: 5 }),
        await survey("Created lately", { created: 100, updated: 100 }),
        await survey("Untouched", { created: 400, updated: 400, answered: 400 }),
      ]);
    };

    test.each<[RetentionSurveyCondition[], string[]]>([
      [["noResponse"], ["Edited lately", "Untouched"]],
      [["noChange"], ["Answered lately", "Untouched"]],
      [["createdBefore"], ["Edited lately", "Answered lately", "Untouched"]],
      [["noResponse", "noChange"], ["Untouched"]],
      [
        ["noChange", "createdBefore"],
        ["Answered lately", "Untouched"],
      ],
      [["noResponse", "noChange", "createdBefore"], ["Untouched"]],
    ])("%j warns about %j", async (conditions, expected) => {
      const surveys = await fixtures();
      await enablePolicy(conditions);

      await sweep();

      const warned = await prisma.retentionNotice.findMany({ where: { entity: "surveys" } });
      const names = Object.entries(surveys)
        .filter(([, id]) => warned.some((row) => row.surveyId === id))
        .map(([name]) => name);
      expect(names.sort()).toEqual([...expected].sort());
    });
  });

  test("a restore under 'no response' alone starts the period over, though no edit counts", async () => {
    await enablePolicy(["noResponse"]);
    const survey = await createSurvey("Old feedback", { age: 400 });
    await prisma.survey.update({ where: { id: survey }, data: { archivedAt: ago(1) } });
    await recordPolicyArchive(survey);
    await setSurveyTimes(survey, { createdAt: ago(400), updatedAt: ago(400) });

    await restoreSurvey(survey);
    // Wind the edit the restore made back: only the restore itself may hold the survey.
    await setSurveyTimes(survey, { createdAt: ago(400), updatedAt: ago(400) });
    await sweep();
    expect(await notice(survey)).toBeNull();
    expect(await prisma.retentionExemption.count()).toBe(0);

    await travel(survey, PERIOD - WARN, CLOCK_MARGIN_MINUTES);
    await sweep();
    expect(await notice(survey)).not.toBeNull();
  });

  test("a restore under 'created before' alone exempts the survey for a period instead", async () => {
    await enablePolicy(["createdBefore"]);
    const survey = await createSurvey("Old feedback", { age: 400 });
    await prisma.survey.update({ where: { id: survey }, data: { archivedAt: ago(1) } });
    await recordPolicyArchive(survey);

    await restoreSurvey(survey, { restoredById: ownerId });
    await sweep();

    expect(await notice(survey)).toBeNull();
    expect(await prisma.retentionRunItem.findMany({ where: { action: "skipped" } })).toEqual([
      expect.objectContaining({ action: "skipped", skipReason: "exempt", targetId: survey }),
    ]);
  });

  // Decided 12 Oct (Tiago): a draft nobody has touched for the whole period is unused data like any other
  // survey, so the policy warns about it and archives it. Only a survey scheduled to launch is left alone.
  test("warns about and archives a draft untouched for the whole period", async () => {
    await enablePolicy(["noChange"]);
    const draft = await createSurvey("Forgotten draft", { age: 400, status: "draft" });

    await sweep();
    expect(await notice(draft)).not.toBeNull();
    expect(vi.mocked(sendSurveyRetentionNoticeEmail).mock.calls[0][0].archivedSurveys).toEqual([
      expect.objectContaining({ name: "Forgotten draft" }),
    ]);

    await ageNotice(draft, WARN + 1);
    await sweep();

    expect((await prisma.survey.findUniqueOrThrow({ where: { id: draft } })).archivedAt).toEqual(
      expect.any(Date)
    );
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

  test("a sweep after the archive does nothing: no email, no History row, a run without changes", async () => {
    await enablePolicy(["noChange"]);
    const stale = await createSurvey("Old feedback", { age: 400 });
    await sweep();
    await ageNotice(stale, WARN + 1);
    await sweep();
    expect(await isArchived(stale)).toBe(true);
    const before = await actions();
    expect(before).toEqual([
      ["notified", stale],
      ["archived", stale],
    ]);

    await sweep();

    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledOnce();
    expect(await actions()).toEqual(before);
    expect(await latestRun()).toMatchObject({ hasChanges: false, finishedAt: expect.any(Date) });
  });

  test("restoring an archived survey restarts its period: a fresh notice, then the full warning", async () => {
    await enablePolicy(["noChange"]);
    const survey = await createSurvey("Old feedback", { age: 400 });
    await sweep();
    await ageNotice(survey, WARN + 1);
    await sweep();
    expect(await isArchived(survey)).toBe(true);

    await restoreSurvey(survey);
    const restored = await prisma.survey.findUniqueOrThrow({ where: { id: survey } });
    expect(restored.archivedAt).toBeNull();
    expect(Date.now() - restored.updatedAt.getTime()).toBeLessThan(60_000);
    const restoredAt = (
      await prisma.retentionSurveyRestore.findUniqueOrThrow({ where: { surveyId: survey } })
    ).restoredAt;
    expect(Math.abs(Date.now() - restoredAt.getTime())).toBeLessThan(60_000);

    // Right after the restore, nothing is due: its old notice is for a clock it no longer has.
    await sweep();
    expect(await isArchived(survey)).toBe(false);
    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledOnce();

    // A full period less the warning later, it is warned again, and not archived on that notice. Each
    // step that should be due goes a few minutes past its boundary: `restoreSurvey` stamps the clock
    // with this process's time and the sweep compares it with the database's, which may drift apart.
    await travel(survey, PERIOD - WARN, CLOCK_MARGIN_MINUTES);
    await sweep();
    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledTimes(2);
    expect(await isArchived(survey)).toBe(false);
    // The clock is the restore or the edit it made, whichever is later (two clocks, so either may lead).
    const [after, marker] = await Promise.all([
      prisma.survey.findUniqueOrThrow({ where: { id: survey } }),
      prisma.retentionSurveyRestore.findUniqueOrThrow({ where: { surveyId: survey } }),
    ]);
    expect((await notice(survey))?.clockAt).toEqual(
      new Date(Math.max(after.updatedAt.getTime(), marker.restoredAt.getTime()))
    );

    // A day short of the period and of the warning: still not archived.
    await travel(survey, WARN - 1);
    await sweep();
    expect(await isArchived(survey)).toBe(false);

    await travel(survey, 1, CLOCK_MARGIN_MINUTES);
    await sweep();
    expect(await isArchived(survey)).toBe(true);
    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledTimes(2);
    expect(await actions()).toEqual([
      ["notified", survey],
      ["archived", survey],
      ["notified", survey],
      ["archived", survey],
    ]);
  });

  test("passes over an owner or creator who was deleted, left the organisation or is billing-only", async () => {
    await enablePolicy(["noChange"]);
    const otherOrganizationId = (await prisma.organization.create({ data: { name: "Other" } })).id;
    const user = async (name: string, role?: "owner" | "member" | "billing") => {
      const { id } = await prisma.user.create({ data: { name, email: `${name}@example.com` } });
      if (role)
        await prisma.membership.create({ data: { userId: id, organizationId, role, accepted: true } });
      return id;
    };
    await user("yan", "owner");
    const cleo = await user("cleo", "member");
    const [gone, alsoGone] = [await user("gone", "member"), await user("also-gone", "member")];
    // Removed from this organisation, still a member of another one.
    const remy = await user("remy");
    await prisma.membership.create({
      data: { userId: remy, organizationId: otherOrganizationId, role: "owner", accepted: true },
    });
    const bill = await user("bill", "billing");

    const surveyBy = async (name: string, owner: string, creator: string) => {
      const { id } = await prisma.survey.create({
        data: { name, workspaceId, ownerId: owner, createdBy: creator },
      });
      await setSurveyTimes(id, { createdAt: ago(400), updatedAt: ago(400) });
    };
    await surveyBy("Owner deleted", gone, cleo);
    await surveyBy("Owner removed", remy, cleo);
    await surveyBy("Owner billing-only", bill, cleo);
    await surveyBy("Both deleted", gone, alsoGone);
    await surveyBy("Both removed", remy, remy);
    await surveyBy("Both billing-only", bill, bill);
    await prisma.user.deleteMany({ where: { id: { in: [gone, alsoGone] } } });

    await sweep();

    const told = Object.fromEntries(
      vi
        .mocked(sendSurveyRetentionNoticeEmail)
        .mock.calls.flatMap(([email]) => email.archivedSurveys.map((survey) => [survey.name, email.email]))
    );
    expect(told).toEqual({
      "Owner deleted": "cleo@example.com",
      "Owner removed": "cleo@example.com",
      "Owner billing-only": "cleo@example.com",
      "Both deleted": "yan@example.com",
      "Both removed": "yan@example.com",
      "Both billing-only": "yan@example.com",
    });
  });

  test("a capped run handles up to its cap, and the next night the rest, none twice", async () => {
    caps.notices = 2;
    caps.actions = 2;
    await enablePolicy(["noChange"]);
    const surveys = [
      await createSurvey("Old 1", { age: 400 }),
      await createSurvey("Old 2", { age: 400 }),
      await createSurvey("Old 3", { age: 400 }),
    ];
    const told = () =>
      vi
        .mocked(sendSurveyRetentionNoticeEmail)
        .mock.calls.flatMap(([email]) => email.archivedSurveys.map((survey) => survey.name))
        .sort();
    const archivedCount = () => prisma.survey.count({ where: { archivedAt: { not: null } } });

    await sweep();
    expect(told()).toHaveLength(2);
    await sweep();
    expect(told()).toEqual(["Old 1", "Old 2", "Old 3"]);

    for (const survey of surveys) await ageNotice(survey, WARN + 1);
    await sweep();
    expect(await archivedCount()).toBe(2);
    await sweep();
    expect(await archivedCount()).toBe(3);
    await sweep();

    expect(told()).toEqual(["Old 1", "Old 2", "Old 3"]);
    const history = await actions();
    for (const action of ["notified", "archived"]) {
      expect(
        history
          .filter(([recorded]) => recorded === action)
          .map(([, targetId]) => targetId)
          .sort()
      ).toEqual([...surveys].sort());
    }
  });
});
