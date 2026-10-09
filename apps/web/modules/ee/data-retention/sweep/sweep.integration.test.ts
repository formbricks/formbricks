import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { RetentionEntity } from "@formbricks/database/prisma";
import { resetDb } from "@/integration/reset-db";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { updateRetentionPolicy } from "../lib/policies-service";
import { RETENTION_RUN_LEASE_MS, RETENTION_SWEEP_GAP_MS } from "./constants";
import { collectDueTargets } from "./due-targets";
import {
  openRetentionRun,
  openRetentionRuns,
  recordRetentionRunActions,
  recordRetentionRunSkips,
} from "./run";
import { runDataRetentionSweep } from "./sweep";
import {
  RetentionPolicyChangedError,
  lockUnchangedRetentionPolicy,
  runSweepTransaction,
} from "./transaction";

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventWithoutRequest: vi.fn().mockResolvedValue(undefined),
}));

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms);

describe("data retention sweep (real Postgres)", () => {
  let organizationId: string;
  let userId: string;

  const enablePolicy = (entity: RetentionEntity, enabledAt: Date, org = organizationId) =>
    prisma.retentionPolicy.create({
      data: {
        organizationId: org,
        entity,
        enabled: true,
        enabledAt,
        warnDays: 30,
        periodDays: 365,
        conditions: entity === "surveys" ? ["noChange"] : [],
        updatedById: userId,
      },
    });

  const addRun = (entity: RetentionEntity, startedAt: Date, finished = true, org = organizationId) =>
    prisma.retentionRun.create({
      data: { organizationId: org, entity, startedAt, finishedAt: finished ? startedAt : null },
    });

  beforeEach(async () => {
    vi.clearAllMocks();
    await resetDb();
    organizationId = (await prisma.organization.create({ data: { name: "Acme" } })).id;
    userId = (await prisma.user.create({ data: { name: "Ada", email: "ada@example.com" } })).id;
  });

  describe("opening a run", () => {
    test("opens nothing for a policy that is off or never saved", async () => {
      await prisma.retentionPolicy.create({
        data: { organizationId, entity: "members", warnDays: 30, periodDays: 365 },
      });

      await expect(openRetentionRun(organizationId, "members")).resolves.toBeNull();
      await expect(openRetentionRun(organizationId, "responses")).resolves.toBeNull();
      expect(await prisma.retentionRun.count()).toBe(0);
    });

    test("snapshots the policy and stamps the run from the database clock", async () => {
      const policy = await enablePolicy("surveys", ago(10 * DAY));

      const run = await openRetentionRun(organizationId, "surveys");

      expect(run?.policy).toEqual({
        id: policy.id,
        organizationId,
        entity: "surveys",
        enabledAt: policy.enabledAt,
        warnDays: 30,
        periodDays: 365,
        conditions: ["noChange"],
      });
      const stored = await prisma.retentionRun.findUniqueOrThrow({ where: { id: run!.runId } });
      expect(stored.startedAt).toEqual(run!.now);
      expect(Math.abs(run!.now.getTime() - Date.now())).toBeLessThan(5_000);
    });

    test("lets exactly one of two concurrent sweeps open a policy, until its lease runs out", async () => {
      await enablePolicy("members", ago(10 * DAY));

      const opened = await Promise.all([
        openRetentionRun(organizationId, "members"),
        openRetentionRun(organizationId, "members"),
      ]);

      expect(opened.filter(Boolean)).toHaveLength(1);
      await prisma.retentionRun.updateMany({ data: { startedAt: ago(RETENTION_RUN_LEASE_MS + HOUR) } });
      await expect(openRetentionRun(organizationId, "members")).resolves.not.toBeNull();
    });

    test("holds the whole organisation while any of its runs is live: a second sweep opens none of it", async () => {
      await enablePolicy("responses", ago(10 * DAY));
      await enablePolicy("members", ago(10 * DAY));

      // A first sweep holds the organisation through one live run, whichever policy it is.
      expect(await openRetentionRuns(organizationId, ["responses"])).toHaveLength(1);

      await expect(openRetentionRuns(organizationId, ["responses", "members"])).resolves.toEqual([]);
      expect(await prisma.retentionRun.count({ where: { entity: "members" } })).toBe(0);
    });

    test("keeps a second sweep out of an organisation another is opening at this moment", async () => {
      await enablePolicy("responses", ago(10 * DAY));
      await enablePolicy("members", ago(10 * DAY));

      let locked!: () => void;
      const lockTaken = new Promise<void>((resolve) => (locked = resolve));
      let release!: () => void;
      const released = new Promise<void>((resolve) => (release = resolve));
      const opening = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`data-retention-sweep:${organizationId}`}))`;
        locked();
        await released;
      });
      await lockTaken;

      await expect(openRetentionRuns(organizationId, ["responses", "members"])).resolves.toEqual([]);
      release();
      await opening;
      await expect(openRetentionRuns(organizationId, ["responses", "members"])).resolves.toHaveLength(2);
    });

    test("restarts the warning when the last run is too old, as a system change", async () => {
      const policy = await enablePolicy("responses", ago(100 * DAY));
      await addRun("responses", ago(RETENTION_SWEEP_GAP_MS + HOUR));

      const run = await openRetentionRun(organizationId, "responses");

      expect(run?.restartedWarning).toEqual({ previousEnabledAt: policy.enabledAt });
      expect(run?.policy.enabledAt).toEqual(run?.now);
      expect(await prisma.retentionPolicy.findUniqueOrThrow({ where: { id: policy.id } })).toMatchObject({
        enabledAt: run?.now,
        updatedById: null,
      });
    });

    test.each([
      ["the last run is recent", ago(DAY), ago(100 * DAY)],
      // One missed night (a dropped tick, a failed licence lookup) must not re-notify everyone.
      ["only one night was missed", ago(49 * HOUR), ago(100 * DAY)],
      ["the warning already restarted since", ago(10 * DAY), ago(DAY)],
      ["there is no earlier run", null, ago(100 * DAY)],
    ])("leaves the warning alone when %s", async (_label, lastRunAt, enabledAt) => {
      const policy = await enablePolicy("responses", enabledAt);
      if (lastRunAt) await addRun("responses", lastRunAt);

      const run = await openRetentionRun(organizationId, "responses");

      expect(run?.restartedWarning).toBeNull();
      expect(run?.policy.enabledAt).toEqual(policy.enabledAt);
    });
  });

  test("an action after a policy change stops the run; an unchanged policy lets it act", async () => {
    await enablePolicy("members", ago(10 * DAY));
    const run = (await openRetentionRun(organizationId, "members"))!;

    await expect(
      runSweepTransaction((tx) => lockUnchangedRetentionPolicy(tx, run.policy))
    ).resolves.toBeUndefined();
    await updateRetentionPolicy({
      organizationId,
      policy: "members",
      patch: { enabled: false },
      updatedById: userId,
    });

    await expect(runSweepTransaction((tx) => lockUnchangedRetentionPolicy(tx, run.policy))).rejects.toThrow(
      RetentionPolicyChangedError
    );
  });

  test("a scan cut short by time resumes where it stopped on the next run", async () => {
    await enablePolicy("members", ago(10 * DAY));
    const keys = Array.from({ length: 250 }, (_, i) => `k${String(i).padStart(3, "0")}`);
    const startsAfter: (string | undefined)[] = [];
    // Each page takes longer than the scan's share of a 100 ms run, so the scan stops after one page.
    const readPage = async (_tx: unknown, afterKey: string | undefined) => {
      startsAfter.push(afterKey);
      await new Promise((resolve) => setTimeout(resolve, 60));
      const from = afterKey ? keys.indexOf(afterKey) + 1 : 0;
      return keys.slice(from, from + 100);
    };
    const scan = async () => {
      const run = (await openRetentionRun(organizationId, "members"))!;
      await collectDueTargets(
        { ...run, deadline: Date.now() + 100 },
        { readPage, keyOf: (key) => key, stepOf: () => null }
      );
      await prisma.retentionRun.update({ where: { id: run.runId }, data: { finishedAt: new Date() } });
    };

    await scan();
    await scan();

    expect(startsAfter).toEqual([undefined, "k099"]);
  });

  describe("History", () => {
    test("counts what a run did on the run itself", async () => {
      await enablePolicy("responses", ago(10 * DAY));
      const run = (await openRetentionRun(organizationId, "responses"))!;

      await prisma.$transaction((tx) =>
        recordRetentionRunActions(tx, run.runId, [
          { targetType: "survey", targetId: "s1", targetName: "Site visit", action: "deleted", count: 40 },
          { targetType: "survey", targetId: "s2", targetName: "NPS", action: "deleted", count: 2 },
          { targetType: "survey", targetId: "s3", action: "notified", recipient: "ada@example.com" },
        ])
      );

      expect(await prisma.retentionRun.findUniqueOrThrow({ where: { id: run.runId } })).toMatchObject({
        deletedCount: 42,
        notifiedCount: 1,
        archivedCount: 0,
      });
      expect(await prisma.retentionRunItem.count({ where: { runId: run.runId } })).toBe(3);
    });

    test("writes and counts a target met twice in one run once", async () => {
      await enablePolicy("members", ago(10 * DAY));
      const run = (await openRetentionRun(organizationId, "members"))!;

      await recordRetentionRunSkips(run, [
        { targetType: "user", targetId: "u1", skipReason: "lastOwner" },
        { targetType: "user", targetId: "u1", skipReason: "lastOwner" },
      ]);

      expect(await prisma.retentionRunItem.count({ where: { runId: run.runId } })).toBe(1);
      expect((await prisma.retentionRun.findUniqueOrThrow({ where: { id: run.runId } })).skippedCount).toBe(
        1
      );
    });

    test("writes a skip once when it starts, and again only when its reason changes", async () => {
      await enablePolicy("members", ago(10 * DAY));
      const skip = (targetId: string, skipReason: "lastOwner" | "otherOrganization") => ({
        targetType: "user" as const,
        targetId,
        skipReason,
      });
      const nightly = async (skips: ReturnType<typeof skip>[]) => {
        const run = (await openRetentionRun(organizationId, "members"))!;
        await recordRetentionRunSkips(run, skips);
        await prisma.retentionRun.update({ where: { id: run.runId }, data: { finishedAt: new Date() } });
        return prisma.retentionRun.findUniqueOrThrow({ where: { id: run.runId }, include: { items: true } });
      };

      const first = await nightly([skip("u1", "lastOwner"), skip("u2", "otherOrganization")]);
      const second = await nightly([skip("u1", "lastOwner"), skip("u2", "lastOwner")]);

      expect(first.skippedCount).toBe(2);
      expect(first.items).toHaveLength(2);
      // Both still skipped and counted; only u2's changed reason is written.
      expect(second.skippedCount).toBe(2);
      expect(second.items.map((item) => [item.targetId, item.skipReason])).toEqual([["u2", "lastOwner"]]);
    });
  });

  describe("the nightly sweep", () => {
    test("skips an unlicensed organisation entirely, and one whose licence lookup fails", async () => {
      await enablePolicy("members", ago(10 * DAY));
      const sweeper = vi.fn();

      const failing = await runDataRetentionSweep({
        sweepers: { members: sweeper },
        checkLicence: async () => {
          throw new Error("licence server down");
        },
      });
      const unlicensed = await runDataRetentionSweep({
        sweepers: { members: sweeper },
        checkLicence: async () => false,
      });

      expect(failing).toMatchObject({ organizations: 1, unlicensed: 1, runs: 0 });
      expect(unlicensed).toMatchObject({ unlicensed: 1, runs: 0 });
      expect(sweeper).not.toHaveBeenCalled();
      expect(await prisma.retentionRun.count()).toBe(0);
    });

    test("runs each enabled policy, closing every run whatever its sweeper did", async () => {
      await enablePolicy("responses", ago(10 * DAY));
      await enablePolicy("surveys", ago(10 * DAY));
      await enablePolicy("members", ago(10 * DAY));

      const summary = await runDataRetentionSweep({
        checkLicence: async () => true,
        sweepers: {
          responses: async ({ runId }) => ({
            act: async () => {
              await prisma.$transaction((tx) =>
                recordRetentionRunActions(tx, runId, [
                  { targetType: "survey", targetId: "s1", action: "deleted", count: 3 },
                ])
              );
            },
          }),
          surveys: async () => {
            throw new Error("boom");
          },
          members: async ({ policy }) => ({
            act: async () => {
              throw new RetentionPolicyChangedError(policy.entity);
            },
          }),
        },
      });

      expect(summary).toMatchObject({ organizations: 1, runs: 3, failedRuns: 1 });
      const runs = await prisma.retentionRun.findMany();
      expect(runs.every((run) => run.finishedAt !== null)).toBe(true);
      const byEntity = Object.fromEntries(runs.map((run) => [run.entity, run]));
      expect(byEntity.responses).toMatchObject({ hasChanges: true, deletedCount: 3 });
      expect(byEntity.surveys.hasChanges).toBe(false);
    });

    test("starts with the organisations swept least recently", async () => {
      const other = (await prisma.organization.create({ data: { name: "Other" } })).id;
      await enablePolicy("members", ago(10 * DAY));
      await enablePolicy("members", ago(10 * DAY), other);
      await addRun("members", ago(HOUR), true, organizationId);
      await addRun("members", ago(2 * HOUR), true, other);
      const order: string[] = [];

      await runDataRetentionSweep({
        checkLicence: async () => true,
        sweepers: {
          members: async ({ policy }) => {
            order.push(policy.organizationId);
            return { act: async () => {} };
          },
        },
      });

      expect(order).toEqual([other, organizationId]);
    });

    test("audits a warning restart as a system change", async () => {
      await enablePolicy("members", ago(100 * DAY));
      await addRun("members", ago(RETENTION_SWEEP_GAP_MS + HOUR));

      await runDataRetentionSweep({
        checkLicence: async () => true,
        sweepers: { members: async () => ({ act: async () => {} }) },
      });

      expect(queueAuditEventWithoutRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "updated",
          targetType: "retentionPolicy",
          organizationId,
          userId: "system",
          userType: "system",
        })
      );
    });
  });
});
