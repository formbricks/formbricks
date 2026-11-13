import { beforeEach, describe, expect, test, vi } from "vitest";
import { runWorkflowRunRetention } from "./run-retention";

const { queryRaw, logUpdateMany, runFindMany, runDeleteMany, sampleFindMany, sampleDeleteMany } = vi.hoisted(
  () => ({
    queryRaw: vi.fn(),
    logUpdateMany: vi.fn(),
    runFindMany: vi.fn(),
    runDeleteMany: vi.fn(),
    sampleFindMany: vi.fn(),
    sampleDeleteMany: vi.fn(),
  })
);

vi.mock("@formbricks/database", () => {
  const tx = { $queryRaw: queryRaw, workflowRunLog: { updateMany: logUpdateMany } };
  return {
    prisma: {
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
      workflowRun: { findMany: runFindMany, deleteMany: runDeleteMany },
      workflowSample: { findMany: sampleFindMany, deleteMany: sampleDeleteMany },
    },
  };
});

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-13T12:00:00.000Z");

const ids = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}` }));

/** The values bound into the content-clearing statement (the tagged template's interpolations). */
const boundValues = (call: unknown[]) => call.slice(1);

const retention = (overrides: Partial<Parameters<typeof runWorkflowRunRetention>[0]> = {}) =>
  runWorkflowRunRetention({ now: NOW, retentionDays: 90, batchSize: 2, maxBatches: 3, ...overrides });

beforeEach(() => {
  vi.clearAllMocks();
  queryRaw.mockResolvedValue([]);
  runFindMany.mockResolvedValue([]);
  sampleFindMany.mockResolvedValue([]);
  logUpdateMany.mockResolvedValue({ count: 0 });
  runDeleteMany.mockImplementation(async ({ where }) => ({ count: where.id.in.length }));
  sampleDeleteMany.mockImplementation(async ({ where }) => ({ count: where.id.in.length }));
});

describe("runWorkflowRunRetention — run content", () => {
  test("clears runs finished before the retention cutoff and stamps the period that applied", async () => {
    queryRaw.mockResolvedValueOnce([{ id: "run1" }]);

    const result = await retention();

    const values = boundValues(queryRaw.mock.calls[0]);
    expect(values).toContainEqual(new Date(NOW.getTime() - 90 * DAY));
    expect(values).toContain(NOW);
    expect(values).toContain(90);
    expect(result.runContentCleared).toBe(1);
  });

  test("clears the step input, output and error of exactly the runs it cleared, in the same transaction", async () => {
    queryRaw.mockResolvedValueOnce([{ id: "run1" }, { id: "run2" }]).mockResolvedValueOnce([]);

    await retention();

    expect(logUpdateMany).toHaveBeenCalledTimes(1);
    expect(logUpdateMany).toHaveBeenCalledWith({
      where: { runId: { in: ["run1", "run2"] } },
      data: { input: {}, output: {}, error: null },
    });
  });

  test("touches no step log when no run is due", async () => {
    await retention();

    expect(logUpdateMany).not.toHaveBeenCalled();
  });

  test("works in bounded batches: stops after a short batch", async () => {
    queryRaw.mockResolvedValueOnce(ids("a", 2)).mockResolvedValueOnce(ids("b", 1));

    const result = await retention();

    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(boundValues(queryRaw.mock.calls[0])).toContain(2);
    expect(result.runContentCleared).toBe(3);
  });

  test("never runs more than maxBatches batches in one tick, leaving the rest for the next", async () => {
    queryRaw.mockResolvedValue(ids("a", 2));

    const result = await retention();

    expect(queryRaw).toHaveBeenCalledTimes(3);
    expect(result.runContentCleared).toBe(6);
  });
});

describe("runWorkflowRunRetention — Test runs", () => {
  test("deletes Test runs created more than 7 days ago, whatever the retention period", async () => {
    runFindMany.mockResolvedValueOnce([{ id: "t1" }]);

    const result = await retention({ retentionDays: 365 });

    const args = runFindMany.mock.calls[0][0];
    expect(args.where).toEqual({ isDryRun: true, createdAt: { lt: new Date(NOW.getTime() - 7 * DAY) } });
    expect(args.take).toBe(2);
    expect(runDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["t1"] }, isDryRun: true },
    });
    expect(result.testRunsDeleted).toBe(1);
  });

  test("is bounded like the content batches", async () => {
    runFindMany.mockResolvedValue(ids("t", 2));

    const result = await retention();

    expect(runFindMany).toHaveBeenCalledTimes(3);
    expect(result.testRunsDeleted).toBe(6);
  });
});

describe("runWorkflowRunRetention — samples", () => {
  test("deletes samples not updated for the retention period, re-checking the age on delete", async () => {
    sampleFindMany.mockResolvedValueOnce([{ id: "s1" }]);
    const cutoff = new Date(NOW.getTime() - 30 * DAY);

    const result = await retention({ retentionDays: 30 });

    expect(sampleFindMany.mock.calls[0][0]).toMatchObject({ where: { updatedAt: { lt: cutoff } }, take: 2 });
    // A sample a call refreshed between the scan and the delete is kept.
    expect(sampleDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["s1"] }, updatedAt: { lt: cutoff } },
    });
    expect(result.samplesDeleted).toBe(1);
  });

  test("counts what was really deleted, not what was scanned", async () => {
    sampleFindMany.mockResolvedValueOnce([{ id: "s1" }, { id: "s2" }]).mockResolvedValueOnce([]);
    sampleDeleteMany.mockResolvedValueOnce({ count: 1 });

    const result = await retention();

    expect(result.samplesDeleted).toBe(1);
  });
});
