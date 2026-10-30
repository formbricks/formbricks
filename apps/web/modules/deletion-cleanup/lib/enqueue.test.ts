import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CLEANUP_SETTLE_MS, STORAGE_CLEANUP_CHUNK_SIZE } from "./constants";
import {
  enqueueResponseOutcomeCleanups,
  enqueueResponsesDeletionCleanups,
  enqueueSurveyDeletionCleanups,
} from "./enqueue";

vi.mock("server-only", () => ({}));
const storage = vi.hoisted(() => ({ configured: true }));
vi.mock("@/lib/constants", () => ({
  get IS_STORAGE_CONFIGURED() {
    return storage.configured;
  },
}));

/**
 * Enqueueing against a real database (rows committed with the delete, rolled back with it, drained in
 * order) is proven in `deletion-cleanup.integration.test.ts`. These pin which rows each delete queues,
 * and which of them are drained straight after commit.
 */
const NOW = new Date("2030-01-10T00:00:00.000Z");
const SCOPE = { organizationId: "clorg", workspaceId: "clwsp", surveyId: "clsrv" };

const makeTx = (tenantIds: string[]) => {
  let next = 0;
  return {
    feedbackDirectory: { findMany: vi.fn().mockResolvedValue(tenantIds.map((id) => ({ id }))) },
    deletionCleanup: {
      createManyAndReturn: vi.fn(async ({ data }: { data: unknown[] }) =>
        data.map(() => ({ id: `cln-${++next}` }))
      ),
      createMany: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
};

const urls = (count: number) => Array.from({ length: count }, (_, index) => `https://files/${index}`);

describe("enqueueSurveyDeletionCleanups", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("drains the folder and flat-key files now, then sweeps the folder and the Hub once uploads have settled", async () => {
    const tx = makeTx(["dir-a", "dir-b"]);
    const fileUrls = urls(STORAGE_CLEANUP_CHUNK_SIZE + 1);

    await expect(enqueueSurveyDeletionCleanups(tx as never, { ...SCOPE, fileUrls })).resolves.toEqual({
      drainNowIds: ["cln-1", "cln-2", "cln-3"],
    });

    expect(tx.feedbackDirectory.findMany).toHaveBeenCalledWith({
      where: { organizationId: "clorg" },
      select: { id: true },
    });
    expect(tx.deletionCleanup.createManyAndReturn).toHaveBeenCalledWith({
      data: [
        { ...SCOPE, kind: "storageSurveyFolder" },
        { ...SCOPE, kind: "storageFiles", fileKeys: fileUrls.slice(0, STORAGE_CLEANUP_CHUNK_SIZE) },
        { ...SCOPE, kind: "storageFiles", fileKeys: fileUrls.slice(STORAGE_CLEANUP_CHUNK_SIZE) },
      ],
      select: { id: true },
    });
    const settledAt = new Date(NOW.getTime() + CLEANUP_SETTLE_MS);
    expect(tx.deletionCleanup.createMany).toHaveBeenCalledWith({
      data: [
        { ...SCOPE, kind: "storageSurveyFolder", nextAttemptAt: settledAt },
        { ...SCOPE, kind: "hubSurvey", tenantIds: ["dir-a", "dir-b"], nextAttemptAt: settledAt },
      ],
    });
  });

  test("without file storage, queues only the Hub cleanup: a storage row could never succeed", async () => {
    storage.configured = false;
    try {
      const tx = makeTx(["dir-a"]);

      await expect(
        enqueueSurveyDeletionCleanups(tx as never, { ...SCOPE, fileUrls: urls(2) })
      ).resolves.toEqual({ drainNowIds: [] });

      expect(tx.deletionCleanup.createManyAndReturn).not.toHaveBeenCalled();
      expect(tx.deletionCleanup.createMany.mock.calls[0][0].data).toEqual([
        expect.objectContaining({ kind: "hubSurvey", tenantIds: ["dir-a"] }),
      ]);
    } finally {
      storage.configured = true;
    }
  });

  test("queues no Hub cleanup for an organisation with no feedback directory", async () => {
    const tx = makeTx([]);

    await enqueueSurveyDeletionCleanups(tx as never, { ...SCOPE, fileUrls: [] });

    expect(tx.deletionCleanup.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ kind: "storageSurveyFolder" }),
    ]);
  });
});

describe("enqueueResponsesDeletionCleanups", () => {
  const WORKSPACE = { organizationId: "clorg", workspaceId: "clwsp" };
  const deleted = (surveyId: string, responseIds: string[], fileUrls: string[] = []) => ({
    surveyId,
    responseIds,
    fileUrls,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("queues nothing when no response was deleted", async () => {
    const tx = makeTx(["dir-a"]);

    await expect(
      enqueueResponsesDeletionCleanups(tx as never, {
        ...WORKSPACE,
        surveys: [deleted("clsrv", [], urls(1))],
      })
    ).resolves.toEqual({ drainNowIds: [] });
    await expect(
      enqueueResponsesDeletionCleanups(tx as never, { ...WORKSPACE, surveys: [] })
    ).resolves.toEqual({ drainNowIds: [] });
    expect(tx.feedbackDirectory.findMany).not.toHaveBeenCalled();
    expect(tx.deletionCleanup.createManyAndReturn).not.toHaveBeenCalled();
  });

  test("drains the responses' files now, and their Hub records once anything on its way has landed", async () => {
    const tx = makeTx(["dir-a"]);

    await expect(
      enqueueResponsesDeletionCleanups(tx as never, {
        ...WORKSPACE,
        surveys: [deleted("clsrv", ["r1", "r2"], urls(1))],
      })
    ).resolves.toEqual({ drainNowIds: ["cln-1"] });

    expect(tx.deletionCleanup.createManyAndReturn).toHaveBeenCalledWith({
      data: [{ ...SCOPE, kind: "storageFiles", fileKeys: urls(1) }],
      select: { id: true },
    });
    // A response deleted just after it was submitted can still have its record on the way to the Hub.
    expect(tx.deletionCleanup.createMany).toHaveBeenCalledWith({
      data: [
        {
          ...SCOPE,
          kind: "hubResponses",
          tenantIds: ["dir-a"],
          responseIds: ["r1", "r2"],
          nextAttemptAt: new Date(NOW.getTime() + CLEANUP_SETTLE_MS),
        },
      ],
    });
  });

  test("queues each survey's responses under that survey, reading the Hub tenants once", async () => {
    const tx = makeTx(["dir-a"]);

    await enqueueResponsesDeletionCleanups(tx as never, {
      ...WORKSPACE,
      surveys: [deleted("s1", ["r1"], urls(1)), deleted("s2", ["r2", "r3"])],
    });

    expect(tx.feedbackDirectory.findMany).toHaveBeenCalledTimes(1);
    expect(tx.deletionCleanup.createManyAndReturn.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ surveyId: "s1", kind: "storageFiles" }),
    ]);
    expect(tx.deletionCleanup.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ surveyId: "s1", kind: "hubResponses", responseIds: ["r1"] }),
      expect.objectContaining({ surveyId: "s2", kind: "hubResponses", responseIds: ["r2", "r3"] }),
    ]);
  });

  test("without file storage, queues the responses' Hub cleanup but none for their files", async () => {
    storage.configured = false;
    try {
      const tx = makeTx(["dir-a"]);

      await enqueueResponsesDeletionCleanups(tx as never, {
        ...WORKSPACE,
        surveys: [deleted("s1", ["r1"], urls(1))],
      });

      expect(tx.deletionCleanup.createManyAndReturn).not.toHaveBeenCalled();
      expect(tx.deletionCleanup.createMany.mock.calls[0][0].data).toEqual([
        expect.objectContaining({ surveyId: "s1", kind: "hubResponses" }),
      ]);
    } finally {
      storage.configured = true;
    }
  });

  test("writes neither kind of row it has nothing for", async () => {
    const tx = makeTx([]);

    await expect(
      enqueueResponsesDeletionCleanups(tx as never, { ...WORKSPACE, surveys: [deleted("clsrv", ["r1"])] })
    ).resolves.toEqual({ drainNowIds: [] });
    expect(tx.deletionCleanup.createManyAndReturn).not.toHaveBeenCalled();
    expect(tx.deletionCleanup.createMany).not.toHaveBeenCalled();
  });
});

describe("enqueueResponseOutcomeCleanups", () => {
  const changes = [
    { id: "r1", surveyId: "s1" },
    { id: "r2", surveyId: "s2" },
  ];

  test("queues one row per changed response, due now, and returns them to drain straight after commit", async () => {
    const tx = makeTx(["dir-a", "dir-b"]);

    await expect(
      enqueueResponseOutcomeCleanups(tx as never, { organizationId: "clorg", workspaceId: "clwsp", changes })
    ).resolves.toEqual({ drainNowIds: ["cln-1", "cln-2"] });

    // The whole batch costs one directory read and one insert, not one of each per response.
    expect(tx.feedbackDirectory.findMany).toHaveBeenCalledTimes(1);
    expect(tx.deletionCleanup.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(tx.deletionCleanup.createManyAndReturn).toHaveBeenCalledWith({
      data: [
        {
          organizationId: "clorg",
          workspaceId: "clwsp",
          surveyId: "s1",
          kind: "hubResponseOutcome",
          tenantIds: ["dir-a", "dir-b"],
          responseIds: ["r1"],
        },
        {
          organizationId: "clorg",
          workspaceId: "clwsp",
          surveyId: "s2",
          kind: "hubResponseOutcome",
          tenantIds: ["dir-a", "dir-b"],
          responseIds: ["r2"],
        },
      ],
      select: { id: true },
    });
  });

  test("cancels what is still pending for those responses first, so a restore cannot be undone by an older row", async () => {
    const tx = makeTx(["dir-a"]);
    const order: string[] = [];
    tx.deletionCleanup.deleteMany.mockImplementation(async () => {
      order.push("cancel");
      return { count: 1 };
    });
    tx.deletionCleanup.createManyAndReturn.mockImplementation(async () => {
      order.push("insert");
      return [{ id: "cln-1" }, { id: "cln-2" }];
    });

    await enqueueResponseOutcomeCleanups(tx as never, {
      organizationId: "clorg",
      workspaceId: "clwsp",
      changes,
    });

    expect(tx.deletionCleanup.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.deletionCleanup.deleteMany).toHaveBeenCalledWith({
      where: { kind: "hubResponseOutcome", workspaceId: "clwsp", responseIds: { hasSome: ["r1", "r2"] } },
    });
    expect(order).toEqual(["cancel", "insert"]);
  });

  test("queues nothing for an organisation without a feedback directory: no record can exist", async () => {
    const tx = makeTx([]);

    await expect(
      enqueueResponseOutcomeCleanups(tx as never, { organizationId: "clorg", workspaceId: "clwsp", changes })
    ).resolves.toEqual({ drainNowIds: [] });

    expect(tx.deletionCleanup.createManyAndReturn).not.toHaveBeenCalled();
  });

  test("does nothing for no changes", async () => {
    const tx = makeTx(["dir-a"]);

    await expect(
      enqueueResponseOutcomeCleanups(tx as never, {
        organizationId: "clorg",
        workspaceId: "clwsp",
        changes: [],
      })
    ).resolves.toEqual({ drainNowIds: [] });

    expect(tx.feedbackDirectory.findMany).not.toHaveBeenCalled();
  });
});
