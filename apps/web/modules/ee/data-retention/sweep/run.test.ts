import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { RETENTION_RUN_LEASE_MS, RETENTION_SWEEP_GAP_MS } from "./constants";
import {
  closeRetentionRun,
  openRetentionRun,
  recordRetentionRunActions,
  recordRetentionRunDeletion,
  recordRetentionRunSkips,
} from "./run";
import { readDatabaseClock, runSweepTransaction } from "./transaction";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { $executeRaw: vi.fn() } }));
vi.mock("./transaction", () => ({
  runSweepTransaction: vi.fn(),
  readDatabaseClock: vi.fn(),
}));

/**
 * Opening, leasing and closing runs against a real database (a held lease skips the policy, a gap
 * restarts the warning, a run that died is released) is proven in `sweep.integration.test.ts`. These
 * pin the decisions made on what the database returned, and what each run records.
 */
const statement = (call: unknown[]) => {
  const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql.replace(/\s+/g, " "), values: sql.values };
};

const ORG_ID = "clorg";
const NOW = new Date("2030-01-10T00:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const HOUR = 60 * 60 * 1000;

const makeTx = () => ({
  $queryRaw: vi.fn(),
  retentionRun: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  retentionPolicy: { update: vi.fn() },
  retentionRunItem: { createMany: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
});
let tx: ReturnType<typeof makeTx>;

beforeEach(() => {
  vi.clearAllMocks();
  tx = makeTx();
  vi.mocked(runSweepTransaction).mockImplementation(((fn: (client: typeof tx) => unknown) =>
    fn(tx)) as never);
  vi.mocked(readDatabaseClock).mockResolvedValue(NOW);
  tx.retentionRun.create.mockResolvedValue({ id: "clrun" });
});

describe("openRetentionRun", () => {
  const policyRow = (overrides: Record<string, unknown> = {}) => ({
    id: "clpol",
    enabled: true,
    enabledAt: ago(10 * 24 * HOUR),
    warnDays: 7,
    periodDays: 30,
    conditions: ["noResponse"],
    ...overrides,
  });
  const previousRun = (startedAt: Date, finishedAt: Date | null, scanCursor: string | null = null) => ({
    startedAt,
    finishedAt,
    scanCursor,
  });

  test("locks the policy row and opens a run on the database clock, resuming the last scan", async () => {
    tx.$queryRaw.mockResolvedValue([policyRow()]);
    tx.retentionRun.findFirst.mockResolvedValue(previousRun(ago(24 * HOUR), ago(23 * HOUR), "clsrv9"));

    await expect(openRetentionRun(ORG_ID, "surveys")).resolves.toEqual({
      runId: "clrun",
      now: NOW,
      policy: {
        id: "clpol",
        organizationId: ORG_ID,
        entity: "surveys",
        enabledAt: ago(10 * 24 * HOUR),
        warnDays: 7,
        periodDays: 30,
        conditions: ["noResponse"],
      },
      restartedWarning: null,
      resumeAfter: "clsrv9",
    });

    const { text, values } = statement(tx.$queryRaw.mock.calls[0]);
    expect(text).toContain('WHERE "organizationId" = ? AND "entity" = ?::"RetentionEntity" FOR UPDATE');
    expect(values).toEqual([ORG_ID, "surveys"]);
    expect(tx.retentionRun.create).toHaveBeenCalledWith({
      data: { organizationId: ORG_ID, entity: "surveys", startedAt: NOW },
      select: { id: true },
    });
    expect(tx.retentionPolicy.update).not.toHaveBeenCalled();
  });

  test.each([
    ["has no row", []],
    ["is off", [policyRow({ enabled: false })]],
    ["has never been switched on", [policyRow({ enabledAt: null })]],
  ])("opens nothing when the policy %s", async (_case, rows) => {
    tx.$queryRaw.mockResolvedValue(rows);

    await expect(openRetentionRun(ORG_ID, "members")).resolves.toBeNull();
    expect(tx.retentionRun.findFirst).not.toHaveBeenCalled();
    expect(tx.retentionRun.create).not.toHaveBeenCalled();
  });

  test("leaves a policy to the sweep holding its lease, and takes over a run that died", async () => {
    tx.$queryRaw.mockResolvedValue([policyRow()]);
    tx.retentionRun.findFirst.mockResolvedValueOnce(previousRun(ago(RETENTION_RUN_LEASE_MS - 1), null));

    await expect(openRetentionRun(ORG_ID, "surveys")).resolves.toBeNull();
    expect(tx.retentionRun.create).not.toHaveBeenCalled();

    tx.retentionRun.findFirst.mockResolvedValueOnce(previousRun(ago(RETENTION_RUN_LEASE_MS), null));
    await expect(openRetentionRun(ORG_ID, "surveys")).resolves.toMatchObject({ runId: "clrun" });
  });

  test("restarts the warning after a gap in sweeps, as a system change", async () => {
    const enabledAt = ago(RETENTION_SWEEP_GAP_MS);
    tx.$queryRaw.mockResolvedValue([policyRow({ enabledAt })]);
    tx.retentionRun.findFirst.mockResolvedValue(previousRun(ago(RETENTION_SWEEP_GAP_MS), ago(1)));

    const run = await openRetentionRun(ORG_ID, "surveys");

    expect(tx.retentionPolicy.update).toHaveBeenCalledWith({
      where: { id: "clpol" },
      data: { enabledAt: NOW, updatedById: null },
    });
    expect(run?.restartedWarning).toEqual({ previousEnabledAt: enabledAt });
    expect(run?.policy.enabledAt).toEqual(NOW);
  });

  test.each([
    ["the policy has never run", null],
    ["the last run is recent", previousRun(ago(RETENTION_SWEEP_GAP_MS - 1), ago(1))],
  ])("keeps the warning when %s", async (_case, previous) => {
    tx.$queryRaw.mockResolvedValue([policyRow({ enabledAt: ago(30 * 24 * HOUR) })]);
    tx.retentionRun.findFirst.mockResolvedValue(previous);

    const run = await openRetentionRun(ORG_ID, "surveys");

    expect(run?.restartedWarning).toBeNull();
    expect(tx.retentionPolicy.update).not.toHaveBeenCalled();
  });

  test("keeps a warning that already restarted since the last run", async () => {
    tx.$queryRaw.mockResolvedValue([policyRow({ enabledAt: ago(RETENTION_SWEEP_GAP_MS - 1) })]);
    tx.retentionRun.findFirst.mockResolvedValue(previousRun(ago(10 * 24 * HOUR), ago(1)));

    await expect(openRetentionRun(ORG_ID, "surveys")).resolves.toMatchObject({ restartedWarning: null });
    expect(tx.retentionPolicy.update).not.toHaveBeenCalled();
  });
});

describe("closeRetentionRun", () => {
  test("stamps the database clock and marks whether the run changed anything", async () => {
    await closeRetentionRun("clrun");

    expect(readDatabaseClock).toHaveBeenCalledWith(prisma);
    const { text, values } = statement(vi.mocked(prisma.$executeRaw).mock.calls[0]);
    expect(text).toContain('"hasChanges" = ("notifiedCount" + "archivedCount" + "deletedCount") > 0');
    expect(values).toEqual([NOW, "clrun"]);
  });
});

describe("recordRetentionRunActions", () => {
  test("writes nothing for no actions", async () => {
    await recordRetentionRunActions(tx as never, "clrun", []);

    expect(tx.retentionRunItem.createMany).not.toHaveBeenCalled();
    expect(tx.retentionRun.update).not.toHaveBeenCalled();
  });

  test("writes a row per action and counts deactivations with archives", async () => {
    await recordRetentionRunActions(tx as never, "clrun", [
      { targetType: "survey", targetId: "s1", targetName: "One", action: "notified", recipient: "a@x.io" },
      { targetType: "user", targetId: "u1", action: "notified" },
      { targetType: "survey", targetId: "s2", action: "archived" },
      { targetType: "user", targetId: "u2", targetName: null, action: "deactivated" },
      { targetType: "survey", targetId: "s3", action: "deleted", count: 40 },
    ]);

    expect(tx.retentionRunItem.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ targetId: "s1", targetName: "One", count: 1, recipient: "a@x.io" }),
      expect.objectContaining({ targetId: "u1", targetName: null, count: 1, recipient: null }),
      expect.objectContaining({ targetId: "s2", action: "archived", count: 1 }),
      expect.objectContaining({ targetId: "u2", action: "deactivated", count: 1 }),
      expect.objectContaining({ targetId: "s3", action: "deleted", count: 40, runId: "clrun" }),
    ]);
    expect(tx.retentionRun.update).toHaveBeenCalledWith({
      where: { id: "clrun" },
      data: {
        notifiedCount: { increment: 2 },
        archivedCount: { increment: 2 },
        deletedCount: { increment: 40 },
      },
    });
  });
});

describe("recordRetentionRunSkips", () => {
  const run = { runId: "clrun", policy: { organizationId: ORG_ID, entity: "surveys" as const } };

  test("opens no transaction for no skips", async () => {
    await recordRetentionRunSkips(run, []);

    expect(runSweepTransaction).not.toHaveBeenCalled();
  });

  test("counts every skipped target once, but writes a row only for a skip that is new", async () => {
    tx.$queryRaw.mockResolvedValue([
      { targetId: "same", action: "skipped", skipReason: "exempt" },
      { targetId: "reason", action: "skipped", skipReason: "noRecipient" },
      { targetId: "acted", action: "notified", skipReason: null },
    ]);

    await recordRetentionRunSkips(run, [
      { targetType: "survey", targetId: "same", targetName: "Same", skipReason: "exempt" },
      { targetType: "survey", targetId: "reason", skipReason: "exempt" },
      { targetType: "survey", targetId: "acted", skipReason: "exempt" },
      { targetType: "survey", targetId: "first", skipReason: "noRecipient" },
      // Met twice in one run: written and counted once.
      { targetType: "survey", targetId: "first", skipReason: "noRecipient" },
    ]);

    const { text, values } = statement(tx.$queryRaw.mock.calls[0]);
    expect(text).toContain('SELECT DISTINCT ON (i."targetId")');
    expect(values).toEqual([["same", "reason", "acted", "first"], ORG_ID, "surveys"]);
    expect(tx.retentionRunItem.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ targetId: "reason", action: "skipped", skipReason: "exempt" }),
      expect.objectContaining({ targetId: "acted", targetName: null, skipReason: "exempt" }),
      expect.objectContaining({ targetId: "first", runId: "clrun", skipReason: "noRecipient" }),
    ]);
    expect(tx.retentionRun.update).toHaveBeenCalledWith({
      where: { id: "clrun" },
      data: { skippedCount: { increment: 4 } },
    });
  });
});

describe("recordRetentionRunDeletion", () => {
  const target = { targetType: "survey" as const, targetId: "s1", targetName: "Survey" };

  test("records nothing for an empty batch", async () => {
    await recordRetentionRunDeletion(tx as never, "clrun", target, 0);

    expect(tx.retentionRunItem.updateMany).not.toHaveBeenCalled();
    expect(tx.retentionRun.update).not.toHaveBeenCalled();
  });

  test("creates the survey's deleted row on the first batch and adds to it on the next", async () => {
    tx.retentionRunItem.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });

    await recordRetentionRunDeletion(tx as never, "clrun", target, 100);
    await recordRetentionRunDeletion(tx as never, "clrun", target, 7);

    expect(tx.retentionRunItem.updateMany).toHaveBeenLastCalledWith({
      where: { runId: "clrun", targetId: "s1", action: "deleted" },
      data: { count: { increment: 7 } },
    });
    expect(tx.retentionRunItem.create).toHaveBeenCalledTimes(1);
    expect(tx.retentionRunItem.create).toHaveBeenCalledWith({
      data: {
        runId: "clrun",
        targetType: "survey",
        targetId: "s1",
        targetName: "Survey",
        action: "deleted",
        count: 100,
      },
    });
    expect(tx.retentionRun.update.mock.calls.map((call) => call[0].data)).toEqual([
      { deletedCount: { increment: 100 } },
      { deletedCount: { increment: 7 } },
    ]);
  });
});
