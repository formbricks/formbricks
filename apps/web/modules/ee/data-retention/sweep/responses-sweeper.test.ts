import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { deleteResponsesInTransaction } from "@/lib/response/delete-responses";
import { drainDeletionCleanups } from "@/modules/deletion-cleanup/lib/drain";
import { enqueueResponsesDeletionCleanups } from "@/modules/deletion-cleanup/lib/enqueue";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { addRetentionDays } from "../lib/schedule";
import {
  SURVEY_RETENTION_DUE_COUNT_CAP,
  countSurveysResponsesCreatedAtOrBefore,
} from "../lib/survey-retention-service";
import { type TNoticeRecipient, resolveSurveyNoticeRecipients } from "./recipients";
import { createResponsesSweeper } from "./responses-sweeper";
import { recordRetentionRunDeletion, recordRetentionRunSkips } from "./run";
import type { TSurveyNoticeItem } from "./survey-notices";
import type { TRetentionSweepContext } from "./sweep";
import { lockUnchangedRetentionPolicy, runSweepTransaction } from "./transaction";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { retentionRun: { update: vi.fn() } } }));
vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/response/delete-responses", () => ({ deleteResponsesInTransaction: vi.fn() }));
vi.mock("@/modules/deletion-cleanup/lib/drain", () => ({ drainDeletionCleanups: vi.fn() }));
vi.mock("@/modules/deletion-cleanup/lib/enqueue", () => ({ enqueueResponsesDeletionCleanups: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEventWithoutRequest: vi.fn() }));
vi.mock("../lib/survey-retention-service", () => ({
  SURVEY_RETENTION_DUE_COUNT_CAP: 10_000,
  countSurveysResponsesCreatedAtOrBefore: vi.fn(),
}));
vi.mock("./recipients", () => ({ resolveSurveyNoticeRecipients: vi.fn() }));
vi.mock("./run", () => ({
  recordRetentionRunDeletion: vi.fn(),
  recordRetentionRunSkips: vi.fn(),
}));
// Batches of two, so a test can show the deletion looping over full batches.
vi.mock("./constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./constants")>()),
  RETENTION_SWEEP_BATCH_SIZE: 2,
}));
vi.mock("./transaction", () => ({
  runSweepTransaction: vi.fn(),
  lockUnchangedRetentionPolicy: vi.fn(),
}));

/**
 * The responses policy against a real database (only due responses go, an exemption holds the survey,
 * one reminder per survey, re-armed once it has nothing in the window, files and Hub records queued) is
 * proven in `responses-sweeper.integration.test.ts`. These pin the decisions made on what the queries
 * return: who is reminded, what the reminder says, and when deletion stops.
 */
const statement = (args: unknown[]) => {
  const [strings, ...values] = args as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql.replace(/\s+/g, " "), values: sql.values };
};

const NOW = new Date("2030-03-01T01:00:00.000Z");
const daysAgo = (days: number) => addRetentionDays(NOW, -days);
const ENABLED_AT = daysAgo(60);
const POLICY = {
  id: "clpol",
  organizationId: "clorg",
  entity: "responses" as const,
  enabledAt: ENABLED_AT,
  warnDays: 7,
  periodDays: 30,
  conditions: [],
};
const CUTOFFS = { noticeDueAtOrBefore: daysAgo(23), actionDueAtOrBefore: daysAgo(30) };

const context = (overrides: Partial<TRetentionSweepContext> = {}): TRetentionSweepContext => ({
  runId: "clrun",
  now: NOW,
  policy: POLICY,
  restartedWarning: null,
  resumeAfter: null,
  deadline: NOW.getTime() + 120_000,
  ...overrides,
});

type TRow = {
  id: string;
  name: string;
  workspaceId: string;
  ownerId: string | null;
  createdBy: string | null;
  oldestResponseAt: Date;
  noticeClaimedAt: Date | null;
  noticeDeliveredAt: Date | null;
  heldUntil: Date | null;
};
const candidate = (id: string, overrides: Partial<TRow> = {}): TRow => ({
  id,
  name: `Survey ${id}`,
  workspaceId: "clwsp",
  ownerId: "alice",
  createdBy: null,
  oldestResponseAt: daysAgo(25),
  noticeClaimedAt: null,
  noticeDeliveredAt: null,
  heldUntil: null,
  ...overrides,
});
/** Reminded ten days ago, after the policy took effect: its warning has run, its oldest responses are due. */
const dueForDeletion = (id: string) =>
  candidate(id, {
    oldestResponseAt: daysAgo(40),
    noticeClaimedAt: daysAgo(10),
    noticeDeliveredAt: daysAgo(10),
  });

const ALICE: TNoticeRecipient = {
  userId: "alice",
  email: "alice@example.com",
  name: "Alice",
  locale: "en-US",
};
const format = { date: (date: Date) => date.toISOString(), number: (value: number) => `#${value}` };

/** The database as the sweeper's raw statements see it. */
const database = ({
  candidates = [] as TRow[],
  held = [] as { id: string; name: string }[],
  recheck = (id: string): TRow[] => candidates.filter((row) => row.id === id),
} = {}) => {
  const tx = {
    $queryRaw: vi.fn(async (...args: unknown[]) => {
      const { text, values } = statement(args);
      if (text.includes('FROM "RetentionExemption" e JOIN "Survey" s')) return held;
      if (text.includes('FROM "Survey" s JOIN "Workspace" w')) {
        if (text.includes('AND s."id" = ?')) return recheck(values[1] as string);
        // Keyset paging on the id, a batch at a time.
        const afterId = text.includes('AND s."id" > ?') ? (values[1] as string) : "";
        return candidates.filter((row) => row.id > afterId).slice(0, values.at(-1) as number);
      }
      return [];
    }),
    $executeRaw: vi.fn().mockResolvedValue(0),
    response: { findMany: vi.fn().mockResolvedValue([]) },
  };
  vi.mocked(runSweepTransaction).mockImplementation(((fn: (client: typeof tx) => unknown) =>
    fn(tx)) as never);
  return tx;
};

const run = async (ctx = context()) => {
  const plan = await createResponsesSweeper()(ctx);
  return { plan, items: (plan.surveyNotices?.items ?? []) as TSurveyNoticeItem<"responses">[] };
};

describe("createResponsesSweeper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(resolveSurveyNoticeRecipients).mockResolvedValue(new Map());
    vi.mocked(countSurveysResponsesCreatedAtOrBefore).mockResolvedValue(new Map());
    vi.mocked(deleteResponsesInTransaction).mockImplementation(async (_tx, where) => {
      const ids = (where.id as { in: string[] }).in;
      return {
        deleted: ids.length,
        deletedIds: ids,
        bySurvey: [{ surveyId: "s1", responseIds: ids, fileUrls: [] }],
      };
    });
    vi.mocked(enqueueResponsesDeletionCleanups).mockResolvedValue({ drainNowIds: ["clcln"] });
    vi.mocked(drainDeletionCleanups).mockResolvedValue({ done: 1, again: 0, failed: 0 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("reads the organisation's surveys with responses in the warning window, and reminds their recipient", async () => {
    const tx = database({ candidates: [candidate("s1"), candidate("s2", { heldUntil: daysAgo(5) })] });
    vi.mocked(resolveSurveyNoticeRecipients).mockResolvedValue(
      new Map([
        ["s1", ALICE],
        ["s2", ALICE],
      ])
    );
    vi.mocked(countSurveysResponsesCreatedAtOrBefore).mockResolvedValue(
      new Map([["s1", { count: 42, relation: "eq" as const }]])
    );

    const { items } = await run();

    const { text, values } = statement(tx.$queryRaw.mock.calls[0]);
    expect(text).toContain('WHERE w."organizationId" = ?');
    expect(text).toContain('ORDER BY s."id" LIMIT ?');
    expect(values).toEqual(["clorg", CUTOFFS.noticeDueAtOrBefore, NOW, 2]);
    expect(countSurveysResponsesCreatedAtOrBefore).toHaveBeenCalledWith(
      ["s1", "s2"],
      CUTOFFS.noticeDueAtOrBefore,
      undefined,
      tx
    );
    expect(
      items.map((item) => [item.survey.id, item.recipient.userId, item.voidBefore, item.clockAt])
    ).toEqual([
      // The reminder follows no one clock, so it is stamped with none.
      ["s1", "alice", ENABLED_AT, null],
      // A reminder claimed before the survey's last exemption ended doesn't count.
      ["s2", "alice", daysAgo(5), null],
    ]);
    // Reminded now, the deletion runs the full warning from tonight.
    expect(items[0].describe(format, "https://app/s1")).toEqual({
      name: "Survey s1",
      url: "https://app/s1",
      count: "#42",
      deleteDate: addRetentionDays(NOW, 7).toISOString(),
    });
    expect(items[1].describe(format, "u").count).toBe("#0");
  });

  test("states a capped count as at least the cap", async () => {
    database({ candidates: [candidate("s1")] });
    vi.mocked(resolveSurveyNoticeRecipients).mockResolvedValue(new Map([["s1", ALICE]]));
    vi.mocked(countSurveysResponsesCreatedAtOrBefore).mockResolvedValue(
      new Map([["s1", { count: SURVEY_RETENTION_DUE_COUNT_CAP, relation: "gte" as const }]])
    );

    const { items } = await run();

    expect(items[0].describe(format, "u").count).toBe(`#${SURVEY_RETENTION_DUE_COUNT_CAP}+`);
  });

  test("never reminds about a survey nobody can be told about, and records it as skipped with the held ones", async () => {
    database({ candidates: [candidate("s1")], held: [{ id: "s9", name: "Held" }] });

    const { plan, items } = await run();
    await plan.act(NOW.getTime() + 60_000);

    expect(items).toEqual([]);
    expect(countSurveysResponsesCreatedAtOrBefore).toHaveBeenCalledWith(
      [],
      expect.any(Date),
      undefined,
      expect.anything()
    );
    expect(recordRetentionRunSkips).toHaveBeenCalledWith(expect.objectContaining({ runId: "clrun" }), [
      { targetType: "survey", targetId: "s9", targetName: "Held", skipReason: "exempt" },
      { targetType: "survey", targetId: "s1", targetName: "Survey s1", skipReason: "noRecipient" },
    ]);
  });

  test("deletes a survey's due responses batch by batch under its lock, queueing their cleanup", async () => {
    const tx = database({ candidates: [dueForDeletion("s1")] });
    tx.response.findMany
      .mockResolvedValueOnce([{ id: "r1" }, { id: "r2" }])
      .mockResolvedValueOnce([{ id: "r3" }]);

    const { plan } = await run();
    await plan.act(NOW.getTime() + 60_000);

    expect(tx.response.findMany).toHaveBeenCalledTimes(2);
    expect(tx.response.findMany).toHaveBeenCalledWith({
      where: { surveyId: "s1", createdAt: { lte: CUTOFFS.actionDueAtOrBefore } },
      select: { id: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 2,
    });
    expect(deleteResponsesInTransaction).toHaveBeenCalledWith(tx, {
      surveyId: "s1",
      id: { in: ["r1", "r2"] },
    });
    expect(enqueueResponsesDeletionCleanups).toHaveBeenCalledWith(tx, {
      organizationId: "clorg",
      workspaceId: "clwsp",
      surveys: [{ surveyId: "s1", responseIds: ["r1", "r2"], fileUrls: [] }],
    });
    expect(recordRetentionRunDeletion).toHaveBeenCalledWith(
      tx,
      "clrun",
      { targetType: "survey", targetId: "s1", targetName: "Survey s1" },
      2
    );
    expect(drainDeletionCleanups).toHaveBeenCalledWith({ ids: ["clcln"] });
    expect(queueAuditEventWithoutRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "deleted",
        targetType: "response",
        oldObject: {
          surveyId: "s1",
          workspaceId: "clwsp",
          deleted: 1,
          responseIds: ["r3"],
          retentionRunId: "clrun",
        },
      })
    );
    // Every batch takes the survey's lock and holds the policy unchanged before it deletes.
    const surveyLocks = tx.$queryRaw.mock.calls
      .map((call) => statement(call).text)
      .filter((text) => text === 'SELECT 1 FROM "Survey" WHERE "id" = ? FOR UPDATE');
    expect(surveyLocks).toHaveLength(2);
    expect(lockUnchangedRetentionPolicy).toHaveBeenCalledWith(tx, POLICY);
  });

  test("deletes nothing once the survey is no longer due under its lock", async () => {
    // An exemption created after the scan: the re-read under lock no longer returns the survey.
    const tx = database({ candidates: [dueForDeletion("s1")], recheck: () => [] });

    const { plan } = await run();
    await plan.act(NOW.getTime() + 60_000);

    expect(tx.response.findMany).not.toHaveBeenCalled();
    expect(deleteResponsesInTransaction).not.toHaveBeenCalled();
  });

  test("deletes nothing when the re-read finds the reminder voided, or no response left", async () => {
    const tx = database({
      candidates: [dueForDeletion("s1"), dueForDeletion("s2")],
      // s1's exemption ended after its reminder was claimed: the reminder is void, a new one is due.
      recheck: (id) =>
        id === "s1" ? [{ ...dueForDeletion("s1"), heldUntil: daysAgo(1) }] : [dueForDeletion("s2")],
    });

    const { plan } = await run();
    await plan.act(NOW.getTime() + 60_000);

    expect(tx.response.findMany).toHaveBeenCalledTimes(1);
    expect(tx.response.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ surveyId: "s2" }) })
    );
    expect(deleteResponsesInTransaction).not.toHaveBeenCalled();
    expect(drainDeletionCleanups).not.toHaveBeenCalled();
  });

  test("keeps going when the audit or the storage drain after commit fails", async () => {
    const tx = database({ candidates: [dueForDeletion("s1")] });
    tx.response.findMany.mockResolvedValueOnce([{ id: "r1" }]);
    vi.mocked(queueAuditEventWithoutRequest).mockRejectedValue(new Error("audit down"));
    vi.mocked(drainDeletionCleanups).mockRejectedValue(new Error("storage down"));

    const { plan } = await run();
    await expect(plan.act(NOW.getTime() + 60_000)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ surveyId: "s1" }),
      "Data retention response deletion audit failed"
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ surveyId: "s1" }),
      "Deferred deleted responses' storage cleanup to the drain job"
    );
    expect(recordRetentionRunSkips).toHaveBeenCalled();
  });

  test("starts no deletion past the deadline, but still re-arms reminders and records skips", async () => {
    const tx = database({ candidates: [dueForDeletion("s1")] });

    const { plan } = await run();
    await plan.act(NOW.getTime() - 1);

    expect(tx.response.findMany).not.toHaveBeenCalled();
    const { text, values } = statement(tx.$executeRaw.mock.calls[0]);
    expect(text).toContain('DELETE FROM "RetentionNotice" n');
    expect(text).toContain("AND NOT EXISTS");
    expect(values).toEqual(["clorg", "clorg", CUTOFFS.noticeDueAtOrBefore]);
    expect(recordRetentionRunSkips).toHaveBeenCalled();
  });

  test("deletes nothing while no reminder can have run its full warning yet", async () => {
    const recent = { ...POLICY, enabledAt: daysAgo(3) };
    const tx = database({ candidates: [dueForDeletion("s1")] });

    const { plan } = await run(context({ policy: recent }));
    await plan.act(NOW.getTime() + 60_000);

    expect(tx.response.findMany).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  test("stops a survey's deletion at the run's deadline between batches", async () => {
    const tx = database({ candidates: [dueForDeletion("s1")] });
    tx.response.findMany.mockImplementation(async () => {
      vi.advanceTimersByTime(60_000);
      return [{ id: "r1" }, { id: "r2" }];
    });

    const { plan } = await run();
    await plan.act(NOW.getTime() + 30_000);

    expect(tx.response.findMany).toHaveBeenCalledTimes(1);
  });
});
