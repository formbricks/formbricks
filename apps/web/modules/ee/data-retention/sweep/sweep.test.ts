import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { RetentionEntity } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { getIsDataRetentionEnabled } from "@/modules/ee/license-check/lib/utils";
import { RETENTION_RUN_BUDGET_MS, RETENTION_SWEEP_BUDGET_MS } from "./constants";
import { type TOpenedRetentionRun, closeRetentionRun, openRetentionRuns } from "./run";
import { type TSurveyNoticeBatch, sendSurveyNotices } from "./survey-notices";
import { type TRetentionSweepPlan, type TRetentionSweeper, runDataRetentionSweep } from "./sweep";
import { RetentionPolicyChangedError } from "./transaction";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEventWithoutRequest: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDataRetentionEnabled: vi.fn() }));
vi.mock("./run", () => ({ openRetentionRuns: vi.fn(), closeRetentionRun: vi.fn() }));
vi.mock("./survey-notices", () => ({ sendSurveyNotices: vi.fn() }));

/**
 * The night's sweep against a real database (licence gating, a held organisation, one email per person
 * across the two survey policies, a policy changed mid-run) is proven in `sweep.integration.test.ts`.
 * These pin how the sweep orders, budgets and isolates each policy's run.
 */
const NOW = new Date("2030-01-10T01:00:00.000Z");

const opened = (organizationId: string, entity: RetentionEntity): TOpenedRetentionRun => ({
  runId: `run-${organizationId}-${entity}`,
  now: NOW,
  policy: {
    id: `pol-${entity}`,
    organizationId,
    entity,
    enabledAt: NOW,
    warnDays: 7,
    periodDays: 30,
    conditions: [],
  },
  restartedWarning: null,
  resumeAfter: null,
});

const notices = (entity: "surveys" | "responses"): TSurveyNoticeBatch =>
  ({ context: { runId: `run-${entity}` }, entity, items: [] }) as unknown as TSurveyNoticeBatch;

/** A sweeper whose plan's `act` is recorded, with survey notices for the two survey policies. */
const sweeperFor = (entity: RetentionEntity) => {
  const act = vi.fn<TRetentionSweepPlan["act"]>().mockResolvedValue(undefined);
  const sweeper = vi.fn<TRetentionSweeper>().mockResolvedValue({
    ...(entity === "members" ? {} : { surveyNotices: notices(entity) }),
    act,
  });
  return { sweeper, act };
};

const orgs = (...organizationIds: string[]) =>
  vi
    .mocked(prisma.$queryRaw)
    .mockResolvedValue(organizationIds.map((organizationId) => ({ organizationId })));

describe("runDataRetentionSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(openRetentionRuns).mockImplementation(async (organizationId, entities) =>
      entities.map((entity) => opened(organizationId, entity))
    );
    vi.mocked(sendSurveyNotices).mockResolvedValue({ changed: [] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("opens the organisation's runs together, sends the survey notices together, then acts, closing every run", async () => {
    orgs("org-1");
    const responses = sweeperFor("responses");
    const surveys = sweeperFor("surveys");
    const members = sweeperFor("members");

    const summary = await runDataRetentionSweep({
      sweepers: { members: members.sweeper, surveys: surveys.sweeper, responses: responses.sweeper },
      checkLicence: async () => true,
    });

    expect(summary).toEqual({ organizations: 1, unlicensed: 0, runs: 3, failedRuns: 0, deferred: 0 });
    // Least recently swept first, so a sweep out of budget leaves last night's to the next.
    const [strings] = vi.mocked(prisma.$queryRaw).mock.calls[0] as unknown as [TemplateStringsArray];
    expect(strings.join("?").replace(/\s+/g, " ")).toContain(
      'ORDER BY last."startedAt" ASC NULLS FIRST, o."organizationId"'
    );
    // One call for the organisation, so a second sweep can't split its policies.
    expect(vi.mocked(openRetentionRuns).mock.calls).toEqual([["org-1", ["responses", "surveys", "members"]]]);
    expect(responses.sweeper).toHaveBeenCalledWith({
      ...opened("org-1", "responses"),
      deadline: NOW.getTime() + RETENTION_RUN_BUDGET_MS,
    });
    // One call for both survey policies, so each person gets one email listing both.
    expect(sendSurveyNotices).toHaveBeenCalledTimes(1);
    expect(sendSurveyNotices).toHaveBeenCalledWith(
      "org-1",
      [notices("responses"), notices("surveys")],
      NOW.getTime() + RETENTION_RUN_BUDGET_MS
    );
    const noticesAt = vi.mocked(sendSurveyNotices).mock.invocationCallOrder[0];
    for (const { sweeper } of [responses, surveys]) {
      expect(sweeper.mock.invocationCallOrder[0]).toBeLessThan(noticesAt);
    }
    // Members read what is due only once the survey notices are out, so their recipients are fresh.
    expect(members.sweeper.mock.invocationCallOrder[0]).toBeGreaterThan(noticesAt);
    for (const { act } of [responses, surveys, members]) {
      expect(act.mock.invocationCallOrder[0]).toBeGreaterThan(members.sweeper.mock.invocationCallOrder[0]);
      expect(act).toHaveBeenCalledWith(NOW.getTime() + RETENTION_RUN_BUDGET_MS);
    }
    expect(vi.mocked(closeRetentionRun).mock.calls.map(([runId]) => runId)).toEqual([
      "run-org-1-responses",
      "run-org-1-surveys",
      "run-org-1-members",
    ]);
  });

  test("leaves a policy with no sweeper, or no run to open, alone", async () => {
    orgs("org-1");
    const surveys = sweeperFor("surveys");
    vi.mocked(openRetentionRuns).mockResolvedValue([]);

    const summary = await runDataRetentionSweep({
      sweepers: { surveys: surveys.sweeper },
      checkLicence: async () => true,
    });

    expect(vi.mocked(openRetentionRuns).mock.calls).toEqual([["org-1", ["surveys"]]]);
    expect(surveys.sweeper).not.toHaveBeenCalled();
    expect(sendSurveyNotices).not.toHaveBeenCalled();
    expect(closeRetentionRun).not.toHaveBeenCalled();
    expect(summary.runs).toBe(0);
  });

  test("touches nothing of an unlicensed organisation, nor of one whose licence lookup fails", async () => {
    orgs("org-1", "org-2", "org-3");
    const checkLicence = vi.fn(async (organizationId: string) => {
      if (organizationId === "org-2") throw new Error("licence server down");
      return organizationId === "org-3";
    });

    const summary = await runDataRetentionSweep({
      sweepers: { members: sweeperFor("members").sweeper },
      checkLicence,
    });

    expect(summary).toEqual({ organizations: 3, unlicensed: 2, runs: 1, failedRuns: 0, deferred: 0 });
    expect(vi.mocked(openRetentionRuns).mock.calls).toEqual([["org-3", ["members"]]]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-2" }),
      "Data retention licence check failed; skipping the organisation"
    );
  });

  test("uses the data retention licence by default", async () => {
    orgs("org-1");
    vi.mocked(getIsDataRetentionEnabled).mockResolvedValue(false);

    await expect(runDataRetentionSweep({ sweepers: {} })).resolves.toMatchObject({ unlicensed: 1 });
    expect(getIsDataRetentionEnabled).toHaveBeenCalledWith("org-1");
  });

  test("stops a policy changed mid-run quietly, fails one that broke, and carries on with the rest", async () => {
    orgs("org-1");
    const responses = sweeperFor("responses");
    responses.sweeper.mockRejectedValue(new RetentionPolicyChangedError("responses"));
    const surveys = sweeperFor("surveys");
    surveys.sweeper.mockRejectedValue(new Error("query failed"));
    const members = sweeperFor("members");

    const summary = await runDataRetentionSweep({
      sweepers: { responses: responses.sweeper, surveys: surveys.sweeper, members: members.sweeper },
      checkLicence: async () => true,
    });

    expect(summary).toMatchObject({ runs: 3, failedRuns: 1 });
    expect(sendSurveyNotices).not.toHaveBeenCalled();
    expect(responses.act).not.toHaveBeenCalled();
    expect(surveys.act).not.toHaveBeenCalled();
    expect(members.act).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "responses" }),
      "Data retention policy changed during its run; stopped"
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "surveys", runId: "run-org-1-surveys" }),
      "Data retention run failed"
    );
  });

  test("acts on neither policy changed before its notices were claimed, quietly", async () => {
    orgs("org-1");
    vi.mocked(sendSurveyNotices).mockResolvedValue({ changed: ["surveys"] });
    const responses = sweeperFor("responses");
    const surveys = sweeperFor("surveys");

    const summary = await runDataRetentionSweep({
      sweepers: { responses: responses.sweeper, surveys: surveys.sweeper },
      checkLicence: async () => true,
    });

    expect(summary).toMatchObject({ runs: 2, failedRuns: 0 });
    expect(responses.act).toHaveBeenCalled();
    expect(surveys.act).not.toHaveBeenCalled();
  });

  test("fails both survey policies when their notices fail, and acts on neither", async () => {
    orgs("org-1");
    vi.mocked(sendSurveyNotices).mockRejectedValue(new Error("smtp exploded"));
    const responses = sweeperFor("responses");
    const surveys = sweeperFor("surveys");
    const members = sweeperFor("members");

    const summary = await runDataRetentionSweep({
      sweepers: { responses: responses.sweeper, surveys: surveys.sweeper, members: members.sweeper },
      checkLicence: async () => true,
    });

    expect(summary).toMatchObject({ runs: 3, failedRuns: 2 });
    expect(responses.act).not.toHaveBeenCalled();
    expect(surveys.act).not.toHaveBeenCalled();
    expect(members.act).toHaveBeenCalled();
  });

  test("counts an action step stopped by a policy change as stopped, and one that throws as failed", async () => {
    orgs("org-1");
    const surveys = sweeperFor("surveys");
    surveys.act.mockRejectedValue(new RetentionPolicyChangedError("surveys"));
    const members = sweeperFor("members");
    members.act.mockRejectedValue(new Error("deadlock"));

    await expect(
      runDataRetentionSweep({
        sweepers: { surveys: surveys.sweeper, members: members.sweeper },
        checkLicence: async () => true,
      })
    ).resolves.toMatchObject({ runs: 2, failedRuns: 1 });
  });

  test("skips only an organisation whose runs can't be opened, and carries on with the next", async () => {
    orgs("org-1", "org-2");
    const failure = new Error("Transaction API error: Unable to start a transaction in the given time.");
    vi.mocked(openRetentionRuns)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce([opened("org-2", "members")]);
    const members = sweeperFor("members");

    const summary = await runDataRetentionSweep({
      sweepers: { members: members.sweeper },
      checkLicence: async () => true,
    });

    expect(summary).toMatchObject({ organizations: 2, runs: 1, failedRuns: 0 });
    expect(members.act).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(
      { error: failure, organizationId: "org-1" },
      "Data retention runs could not be opened; skipping the organisation"
    );
  });

  test("fails the job when the database fails closing a run: an infrastructure failure", async () => {
    orgs("org-1");
    const failure = new Error("connection lost");
    vi.mocked(closeRetentionRun).mockRejectedValueOnce(failure);

    await expect(
      runDataRetentionSweep({
        sweepers: { responses: sweeperFor("responses").sweeper, surveys: sweeperFor("surveys").sweeper },
        checkLicence: async () => true,
      })
    ).rejects.toBe(failure);
    expect(closeRetentionRun).toHaveBeenCalledWith("run-org-1-responses");
  });

  test("audits a warning restarted after a gap as a system change, and carries on if the audit fails", async () => {
    orgs("org-1");
    const previousEnabledAt = new Date("2029-12-01T00:00:00.000Z");
    vi.mocked(openRetentionRuns).mockResolvedValue([
      { ...opened("org-1", "members"), restartedWarning: { previousEnabledAt } },
    ]);
    vi.mocked(queueAuditEventWithoutRequest).mockRejectedValue(new Error("audit queue down"));
    const members = sweeperFor("members");

    await runDataRetentionSweep({ sweepers: { members: members.sweeper }, checkLicence: async () => true });

    expect(queueAuditEventWithoutRequest).toHaveBeenCalledWith({
      action: "updated",
      targetType: "retentionPolicy",
      targetId: "pol-members",
      organizationId: "org-1",
      userId: "system",
      userType: "system",
      status: "success",
      oldObject: { entity: "members", enabledAt: previousEnabledAt },
      newObject: { entity: "members", enabledAt: NOW },
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ policyId: "pol-members" }),
      "Data retention warning restart audit failed"
    );
    expect(members.act).toHaveBeenCalled();
  });

  test("leaves the organisations it has no time for to the next night", async () => {
    orgs("org-1", "org-2", "org-3");
    const checkLicence = vi.fn(async () => {
      vi.advanceTimersByTime(RETENTION_SWEEP_BUDGET_MS);
      return false;
    });

    const summary = await runDataRetentionSweep({ sweepers: {}, checkLicence });

    expect(checkLicence).toHaveBeenCalledTimes(1);
    expect(summary).toEqual({ organizations: 1, unlicensed: 1, runs: 0, failedRuns: 0, deferred: 2 });
  });
});
