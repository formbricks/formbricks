import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CLEANUP_SETTLE_MS, STORAGE_CLEANUP_CHUNK_SIZE } from "./constants";
import { enqueueResponsesDeletionCleanups, enqueueSurveyDeletionCleanups } from "./enqueue";

vi.mock("server-only", () => ({}));

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

  test("queues no Hub cleanup for an organisation with no feedback directory", async () => {
    const tx = makeTx([]);

    await enqueueSurveyDeletionCleanups(tx as never, { ...SCOPE, fileUrls: [] });

    expect(tx.deletionCleanup.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ kind: "storageSurveyFolder" }),
    ]);
  });
});

describe("enqueueResponsesDeletionCleanups", () => {
  test("queues nothing when no response was deleted", async () => {
    const tx = makeTx(["dir-a"]);

    await expect(
      enqueueResponsesDeletionCleanups(tx as never, { ...SCOPE, responseIds: [], fileUrls: urls(1) })
    ).resolves.toEqual({ drainNowIds: [] });
    expect(tx.feedbackDirectory.findMany).not.toHaveBeenCalled();
    expect(tx.deletionCleanup.createManyAndReturn).not.toHaveBeenCalled();
  });

  test("drains the responses' files now and leaves their Hub records to the drain job", async () => {
    const tx = makeTx(["dir-a"]);

    await expect(
      enqueueResponsesDeletionCleanups(tx as never, {
        ...SCOPE,
        responseIds: ["r1", "r2"],
        fileUrls: urls(1),
      })
    ).resolves.toEqual({ drainNowIds: ["cln-1"] });

    expect(tx.deletionCleanup.createManyAndReturn).toHaveBeenCalledWith({
      data: [{ ...SCOPE, kind: "storageFiles", fileKeys: urls(1) }],
      select: { id: true },
    });
    // Older than the period by now: nothing is still on its way to the Hub, so no settle wait.
    expect(tx.deletionCleanup.createMany).toHaveBeenCalledWith({
      data: [{ ...SCOPE, kind: "hubResponses", tenantIds: ["dir-a"], responseIds: ["r1", "r2"] }],
    });
  });

  test("writes neither kind of row it has nothing for", async () => {
    const tx = makeTx([]);

    await expect(
      enqueueResponsesDeletionCleanups(tx as never, { ...SCOPE, responseIds: ["r1"], fileUrls: [] })
    ).resolves.toEqual({ drainNowIds: [] });
    expect(tx.deletionCleanup.createManyAndReturn).not.toHaveBeenCalled();
    expect(tx.deletionCleanup.createMany).not.toHaveBeenCalled();
  });
});
