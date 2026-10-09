import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { deleteResponseFileUrls } from "@/modules/storage/lib/delete-response-files";
import { deleteSurveyUploadFolder } from "@/modules/storage/service";
import {
  CLEANUP_SETTLE_MS,
  DELETION_CLEANUP_CLAIM_BATCH,
  DELETION_CLEANUP_LEASE_SECONDS,
  DELETION_CLEANUP_RUN_BUDGET_MS,
  getDeletionCleanupRetryDelayMs,
} from "./constants";
import { drainDeletionCleanups } from "./drain";
import { type THubCleanupResult, deleteHubRecords } from "./hub-cleanup";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    survey: { findUnique: vi.fn() },
    response: { findFirst: vi.fn() },
    deletionCleanup: { deleteMany: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/storage/lib/delete-response-files", () => ({ deleteResponseFileUrls: vi.fn() }));
vi.mock("@/modules/storage/service", () => ({ deleteSurveyUploadFolder: vi.fn() }));
vi.mock("./hub-cleanup", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./hub-cleanup")>()),
  deleteHubRecords: vi.fn(),
}));

/**
 * The drain against a real database (rows claimed with `SKIP LOCKED`, a lease-fenced finish, budgets
 * releasing the rest, a storage failure keeping only the failed keys, the Hub filter) is proven in
 * `deletion-cleanup.integration.test.ts`. These pin how each kind of row is judged and rescheduled.
 */
const statement = (args: unknown[]) => {
  const [strings, ...values] = args as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql.replace(/\s+/g, " "), values: sql.values };
};

const NOW = new Date("2030-01-10T00:00:00.000Z");
const LEASE_UNTIL = new Date(NOW.getTime() + DELETION_CLEANUP_LEASE_SECONDS * 1000);

type TKind = "hubSurvey" | "hubResponses" | "storageSurveyFolder" | "storageFiles" | "somethingNew";
const row = (id: string, kind: TKind, overrides: Record<string, unknown> = {}) => ({
  id,
  kind,
  organizationId: "clorg",
  workspaceId: "clwsp",
  surveyId: "clsrv",
  tenantIds: ["dir-a"],
  responseIds: ["r1", "r2"],
  fileKeys: ["k1", "k2", "k3"],
  attempts: 2,
  leaseUntil: LEASE_UNTIL,
  ...overrides,
});

/** The queue hands out these rows on the first claim, and nothing after. */
const queue = (...rows: ReturnType<typeof row>[]) =>
  vi
    .mocked(prisma.$queryRaw)
    .mockResolvedValueOnce(rows as never)
    .mockResolvedValue([] as never);

const leased = (id: string) => ({ id, nextAttemptAt: LEASE_UNTIL });
const updates = () => vi.mocked(prisma.deletionCleanup.updateMany).mock.calls.map(([args]) => args);

describe("drainDeletionCleanups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.response.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.deletionCleanup.deleteMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.deletionCleanup.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(deleteSurveyUploadFolder).mockResolvedValue(true);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("does nothing for an empty list of rows to drain", async () => {
    await expect(drainDeletionCleanups({ ids: [] })).resolves.toEqual({ done: 0, again: 0, failed: 0 });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test("claims due rows under a lease, narrowed to the given ids, until the queue is empty", async () => {
    queue(row("c1", "storageSurveyFolder"));

    await expect(drainDeletionCleanups({ ids: ["c1"] })).resolves.toEqual({ done: 1, again: 0, failed: 0 });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    const { text, values } = statement(vi.mocked(prisma.$queryRaw).mock.calls[0]);
    expect(text).toContain('AND "id" = ANY(?::text[])');
    expect(text).toContain("LIMIT ? FOR UPDATE SKIP LOCKED");
    expect(values).toEqual([LEASE_UNTIL, NOW, NOW, ["c1"], DELETION_CLEANUP_CLAIM_BATCH]);
    expect(deleteSurveyUploadFolder).toHaveBeenCalledWith({ workspaceId: "clwsp", surveyId: "clsrv" });
    // Finished only while this drain still holds the lease.
    expect(prisma.deletionCleanup.deleteMany).toHaveBeenCalledWith({ where: leased("c1") });
  });

  test("drains the whole queue when no ids are given", async () => {
    queue();

    await drainDeletionCleanups();

    expect(statement(vi.mocked(prisma.$queryRaw).mock.calls[0]).text).not.toContain("ANY(");
  });

  test("never removes a live survey's folder or Hub records: the row waits with backoff instead", async () => {
    queue(row("c1", "storageSurveyFolder"), row("c2", "hubSurvey"));
    vi.mocked(prisma.survey.findUnique).mockResolvedValue({ id: "clsrv" } as never);

    await expect(drainDeletionCleanups()).resolves.toEqual({ done: 0, again: 0, failed: 2 });

    expect(deleteSurveyUploadFolder).not.toHaveBeenCalled();
    expect(deleteHubRecords).not.toHaveBeenCalled();
    expect(updates()[0]).toEqual({
      where: leased("c1"),
      data: {
        attempts: 3,
        lastError: "surveyExists",
        nextAttemptAt: new Date(NOW.getTime() + getDeletionCleanupRetryDelayMs(3)),
      },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ cleanupId: "c1", attempts: 3, error: "surveyExists" }),
      "Deletion cleanup failed; will retry"
    );
  });

  test("waits while a response it names still exists, and otherwise cleans up just those responses", async () => {
    queue(row("c1", "hubResponses"), row("c2", "hubResponses", { responseIds: ["r9"] }));
    vi.mocked(prisma.response.findFirst)
      .mockResolvedValueOnce({ id: "r1" } as never)
      .mockResolvedValueOnce(null);
    vi.mocked(deleteHubRecords).mockResolvedValue({ status: "clean" });

    await expect(drainDeletionCleanups()).resolves.toEqual({ done: 1, again: 0, failed: 1 });

    expect(prisma.response.findFirst).toHaveBeenCalledWith({
      where: { id: { in: ["r1", "r2"] } },
      select: { id: true },
    });
    expect(updates()[0].data).toMatchObject({ lastError: "responseExists" });
    expect(deleteHubRecords).toHaveBeenCalledTimes(1);
    expect(deleteHubRecords).toHaveBeenCalledWith(
      { tenantIds: ["dir-a"], surveyId: "clsrv", responseIds: ["r9"] },
      expect.objectContaining({ remaining: expect.any(Number) })
    );
  });

  test.each<[string, THubCleanupResult, Record<string, unknown>]>([
    [
      "looks once more after the settle time when it deleted records",
      { status: "deleted", count: 3 },
      { attempts: 0, lastError: null, nextAttemptAt: new Date(NOW.getTime() + CLEANUP_SETTLE_MS) },
    ],
    [
      "is due again at once when the budget ran out mid-row",
      { status: "budget", count: 3 },
      { attempts: 0, lastError: null, nextAttemptAt: NOW },
    ],
    [
      "backs off when the Hub call failed",
      { status: "failed", error: "hub500" },
      {
        attempts: 3,
        lastError: "hub500",
        nextAttemptAt: new Date(NOW.getTime() + getDeletionCleanupRetryDelayMs(3)),
      },
    ],
  ])("a whole-survey Hub cleanup %s", async (_case, result, data) => {
    queue(row("c1", "hubSurvey"));
    vi.mocked(deleteHubRecords).mockResolvedValue(result);

    await drainDeletionCleanups();

    expect(deleteHubRecords).toHaveBeenCalledWith(
      { tenantIds: ["dir-a"], surveyId: "clsrv" },
      expect.anything()
    );
    expect(updates()).toEqual([{ where: leased("c1"), data }]);
  });

  test("waits quietly for a Hub that isn't configured", async () => {
    queue(row("c1", "hubSurvey"));
    vi.mocked(deleteHubRecords).mockResolvedValue({ status: "failed", error: "hubNotConfigured" });

    await drainDeletionCleanups();

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ error: "hubNotConfigured" }),
      "Deletion cleanup failed; will retry"
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("keeps only the files storage failed to delete, for the retry", async () => {
    queue(row("c1", "storageFiles"), row("c2", "storageFiles", { fileKeys: ["k9"] }));
    vi.mocked(deleteResponseFileUrls)
      .mockResolvedValueOnce({ failed: ["k2"] } as never)
      .mockResolvedValueOnce({ failed: [] } as never);

    await expect(drainDeletionCleanups()).resolves.toEqual({ done: 1, again: 0, failed: 1 });

    expect(deleteResponseFileUrls).toHaveBeenCalledWith(["k1", "k2", "k3"], "clwsp");
    expect(updates()[0].data).toMatchObject({ lastError: "storage", fileKeys: ["k2"] });
    expect(prisma.deletionCleanup.deleteMany).toHaveBeenCalledWith({ where: leased("c2") });
  });

  test("backs off a folder storage failed to delete, an unknown kind, and a row that threw", async () => {
    queue(row("c1", "storageSurveyFolder"), row("c2", "somethingNew"), row("c3", "storageSurveyFolder"));
    vi.mocked(deleteSurveyUploadFolder)
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error("socket hang up"));

    await expect(drainDeletionCleanups()).resolves.toEqual({ done: 0, again: 0, failed: 3 });

    expect(updates().map(({ data }) => data.lastError)).toEqual(["storage", "unknownKind", "error"]);
    expect(updates()[0].data).not.toHaveProperty("fileKeys");
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ cleanupId: "c3", kind: "storageSurveyFolder" }),
      "Deletion cleanup threw"
    );
  });

  test("leaves a row it lost the lease on to the newer claim", async () => {
    queue(row("c1", "storageSurveyFolder"));
    vi.mocked(prisma.deletionCleanup.deleteMany).mockResolvedValue({ count: 0 });

    await drainDeletionCleanups();

    expect(logger.warn).toHaveBeenCalledWith(
      { cleanupId: "c1", kind: "storageSurveyFolder" },
      "Deletion cleanup lease lost; left to the newer claim"
    );
  });

  test("hands the rest of its claim straight back once the Hub call budget is spent", async () => {
    queue(row("c1", "hubSurvey"), row("c2", "hubSurvey"), row("c3", "storageFiles"));
    vi.mocked(deleteHubRecords).mockImplementation(async (_target, budget) => {
      budget.remaining = 0;
      return { status: "budget", count: 100 };
    });

    await expect(drainDeletionCleanups()).resolves.toEqual({ done: 0, again: 1, failed: 0 });

    expect(deleteHubRecords).toHaveBeenCalledTimes(1);
    expect(updates().at(-1)).toEqual({
      where: { OR: [leased("c2"), leased("c3")] },
      data: { nextAttemptAt: NOW },
    });
    // It stops rather than claiming again.
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  test("hands the rest back, and claims no more, once its time is up", async () => {
    queue(row("c1", "storageSurveyFolder"), row("c2", "storageSurveyFolder"));
    vi.mocked(deleteSurveyUploadFolder).mockImplementation(async () => {
      vi.advanceTimersByTime(DELETION_CLEANUP_RUN_BUDGET_MS);
      return true;
    });

    await expect(drainDeletionCleanups()).resolves.toEqual({ done: 1, again: 0, failed: 0 });

    const after = new Date(NOW.getTime() + DELETION_CLEANUP_RUN_BUDGET_MS);
    expect(updates()).toEqual([{ where: { OR: [leased("c2")] }, data: { nextAttemptAt: after } }]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
