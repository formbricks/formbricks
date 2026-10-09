import "server-only";
import { prisma } from "@formbricks/database";
import type {
  Prisma,
  RetentionEntity,
  RetentionRunItemAction,
  RetentionSkipReason,
  RetentionSurveyCondition,
  RetentionTargetType,
} from "@formbricks/database/prisma";
import { RETENTION_RUN_LEASE_MS, RETENTION_SWEEP_GAP_MS } from "./constants";
import { type TRetentionPolicySnapshot, readDatabaseClock, runSweepTransaction } from "./transaction";

export type TOpenedRetentionRun = {
  runId: string;
  /** The run's clock: the database's, read when the run opened. */
  now: Date;
  policy: TRetentionPolicySnapshot;
  /** Set when the run restarted the policy's warning first (`RETENTION_SWEEP_GAP_MS`). */
  restartedWarning: { previousEnabledAt: Date } | null;
  /** Where the previous run's scan stopped for want of time; this run's scan starts after it. */
  resumeAfter: string | null;
};

/**
 * The first key of the per-organisation advisory lock taken while an organisation's runs are opened.
 * The two-key form has its own key space, apart from the single-key locks other features take (e.g.
 * `survey-visibility:` in lib/authzed), so a hash collision can't make one wait on the other.
 */
const RETENTION_SWEEP_LOCK_NAMESPACE = "data-retention-sweep";

/**
 * Open one organisation's runs for the night, one per enabled policy in `entities` (in that order), or
 * none when another sweep holds the organisation. The organisation is one unit: a second sweep (another
 * replica, an overlapping tick) takes all of its policies or none, so it can never split them with the
 * first and send its people a second email.
 * - A transaction-scoped advisory lock on the organisation (`pg_try_advisory_xact_lock`) serialises two
 *   sweeps opening it at the same moment: the one that doesn't get it leaves the organisation alone.
 * - Past that, the organisation is held while any of its runs is unfinished and younger than
 *   `RETENTION_RUN_LEASE_MS`; a run that died is released after it.
 *
 * Each policy's row is locked as its run opens, which orders the opening against an edit. When the
 * policy's last run is more than `RETENTION_SWEEP_GAP_MS` old, and its warning hasn't restarted since,
 * the warning restarts first (`enabledAt` moves to now; ENG-3614): every notice given before is void and
 * the full warning runs again, so no backlog acts on the night the sweep comes back. A policy with no
 * earlier run has nothing to catch up on.
 */
export const openRetentionRuns = (
  organizationId: string,
  entities: readonly RetentionEntity[]
): Promise<TOpenedRetentionRun[]> =>
  runSweepTransaction(async (tx) => {
    const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(hashtext(${RETENTION_SWEEP_LOCK_NAMESPACE}), hashtext(${organizationId})) AS "locked"
    `;
    if (!locked) return [];

    const now = await readDatabaseClock(tx);
    const held = await tx.retentionRun.findFirst({
      where: {
        organizationId,
        finishedAt: null,
        startedAt: { gt: new Date(now.getTime() - RETENTION_RUN_LEASE_MS) },
      },
      select: { id: true },
    });
    if (held) return [];

    const runs: TOpenedRetentionRun[] = [];
    for (const entity of entities) {
      const run = await openPolicyRun(tx, organizationId, entity);
      if (run) runs.push(run);
    }
    return runs;
  });

/** Open one policy's run inside `openRetentionRuns`, or return null when the policy is off. */
const openPolicyRun = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  entity: RetentionEntity
): Promise<TOpenedRetentionRun | null> => {
  const [locked] = await tx.$queryRaw<
    {
      id: string;
      enabled: boolean;
      enabledAt: Date | null;
      warnDays: number;
      periodDays: number;
      conditions: RetentionSurveyCondition[];
    }[]
  >`
    SELECT "id", "enabled", "enabledAt", "warnDays", "periodDays", "conditions"::text[] AS "conditions"
    FROM "RetentionPolicy"
    WHERE "organizationId" = ${organizationId} AND "entity" = ${entity}::"RetentionEntity"
    FOR UPDATE
  `;
  if (!locked?.enabled || !locked.enabledAt) return null;

  // Read after the policy's lock, so a run that waited for an edit stamps the moment it opens.
  const now = await readDatabaseClock(tx);
  const previous = await tx.retentionRun.findFirst({
    where: { organizationId, entity },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    select: { startedAt: true, scanCursor: true },
  });
  const age = (date: Date) => now.getTime() - date.getTime();

  let enabledAt = locked.enabledAt;
  let restartedWarning: TOpenedRetentionRun["restartedWarning"] = null;
  if (
    previous &&
    age(previous.startedAt) >= RETENTION_SWEEP_GAP_MS &&
    age(enabledAt) >= RETENTION_SWEEP_GAP_MS
  ) {
    await tx.retentionPolicy.update({
      where: { id: locked.id },
      // A system change: no person made it.
      data: { enabledAt: now, updatedById: null },
    });
    restartedWarning = { previousEnabledAt: enabledAt };
    enabledAt = now;
  }

  const run = await tx.retentionRun.create({
    data: { organizationId, entity, startedAt: now },
    select: { id: true },
  });

  return {
    runId: run.id,
    now,
    policy: {
      id: locked.id,
      organizationId,
      entity,
      enabledAt,
      warnDays: locked.warnDays,
      periodDays: locked.periodDays,
      conditions: locked.conditions,
    },
    restartedWarning,
    resumeAfter: previous?.scanCursor ?? null,
  };
};

/**
 * Open one policy's run on its own (`openRetentionRuns` with that one policy), or null when there is
 * nothing to run: the policy is off, or another sweep holds the organisation.
 */
export const openRetentionRun = async (
  organizationId: string,
  entity: RetentionEntity
): Promise<TOpenedRetentionRun | null> => (await openRetentionRuns(organizationId, [entity]))[0] ?? null;

/** Close a run: History shows it finished, and hides it by default when it changed nothing. */
export const closeRetentionRun = async (runId: string): Promise<void> => {
  const finishedAt = await readDatabaseClock(prisma);
  await prisma.$executeRaw`
    UPDATE "RetentionRun"
    SET "finishedAt" = ${finishedAt},
        "hasChanges" = ("notifiedCount" + "archivedCount" + "deletedCount") > 0
    WHERE "id" = ${runId}
  `;
};

type TRunTarget = { targetType: RetentionTargetType; targetId: string; targetName?: string | null };

export type TRetentionRunAction = TRunTarget & {
  action: Exclude<RetentionRunItemAction, "skipped">;
  /** Deleted responses, for a grouped `deleted` row; 1 otherwise. */
  count?: number;
  /** Who was emailed, for a `notified` row that sent one. */
  recipient?: string | null;
};

/**
 * Record what a run did, in the transaction that did it, so History can't miss an action or list one that
 * rolled back. Each row also counts on the run: archived surveys and deactivated members share
 * `archivedCount`, deleted responses add up in `deletedCount`.
 */
export const recordRetentionRunActions = async (
  tx: Prisma.TransactionClient,
  runId: string,
  actions: readonly TRetentionRunAction[]
): Promise<void> => {
  if (actions.length === 0) return;
  await tx.retentionRunItem.createMany({
    data: actions.map((item) => ({
      runId,
      targetType: item.targetType,
      targetId: item.targetId,
      targetName: item.targetName ?? null,
      action: item.action,
      count: item.count ?? 1,
      recipient: item.recipient ?? null,
    })),
  });
  const counted = (actionNames: readonly TRetentionRunAction["action"][]) =>
    actions
      .filter((item) => actionNames.includes(item.action))
      .reduce((total, item) => total + (item.count ?? 1), 0);
  await tx.retentionRun.update({
    where: { id: runId },
    data: {
      notifiedCount: { increment: counted(["notified"]) },
      archivedCount: { increment: counted(["archived", "deactivated"]) },
      deletedCount: { increment: counted(["deleted"]) },
    },
  });
};

export type TRetentionRunSkip = TRunTarget & { skipReason: RetentionSkipReason };

/**
 * Count skipped targets on the run, but write a row only for a skip that is new: the target's latest row
 * under this policy isn't the same skip. A target held by an exemption is otherwise skipped, and written,
 * every night; History shows when the skip started (or its reason changed) instead. Rows this run already
 * wrote count too, so a target met twice in one run is written once.
 */
export const recordRetentionRunSkips = async (
  run: { runId: string; policy: Pick<TRetentionPolicySnapshot, "organizationId" | "entity"> },
  allSkips: readonly TRetentionRunSkip[]
): Promise<void> => {
  // One skip per target, so a target met twice is written and counted once.
  const skips = [...new Map(allSkips.map((skip) => [skip.targetId, skip])).values()];
  if (skips.length === 0) return;
  await runSweepTransaction(async (tx) => {
    const latest = await tx.$queryRaw<
      { targetId: string; action: RetentionRunItemAction; skipReason: RetentionSkipReason | null }[]
    >`
    SELECT DISTINCT ON (i."targetId") i."targetId", i."action", i."skipReason"
    FROM "RetentionRunItem" i
    JOIN "RetentionRun" r ON r."id" = i."runId"
    WHERE i."targetId" = ANY(${skips.map((skip) => skip.targetId)}::text[])
      AND r."organizationId" = ${run.policy.organizationId}
      AND r."entity" = ${run.policy.entity}::"RetentionEntity"
    ORDER BY i."targetId", r."startedAt" DESC, i."id" DESC
  `;
    const latestByTarget = new Map(latest.map((row) => [row.targetId, row]));
    const fresh = skips.filter((skip) => {
      const previous = latestByTarget.get(skip.targetId);
      return previous?.action !== "skipped" || previous.skipReason !== skip.skipReason;
    });

    await tx.retentionRunItem.createMany({
      data: fresh.map((skip) => ({
        runId: run.runId,
        targetType: skip.targetType,
        targetId: skip.targetId,
        targetName: skip.targetName ?? null,
        action: "skipped" as const,
        skipReason: skip.skipReason,
      })),
    });
    await tx.retentionRun.update({
      where: { id: run.runId },
      data: { skippedCount: { increment: skips.length } },
    });
  });
};

/**
 * Add `count` deleted responses to the survey's `deleted` row on this run, creating it on the first
 * batch, so History shows one row per survey however many batches its deletion took. In the deleting
 * transaction, like `recordRetentionRunActions`.
 */
export const recordRetentionRunDeletion = async (
  tx: Prisma.TransactionClient,
  runId: string,
  target: TRunTarget,
  count: number
): Promise<void> => {
  if (count <= 0) return;
  const { count: updated } = await tx.retentionRunItem.updateMany({
    where: { runId, targetId: target.targetId, action: "deleted" },
    data: { count: { increment: count } },
  });
  if (updated === 0) {
    await tx.retentionRunItem.create({
      data: {
        runId,
        targetType: target.targetType,
        targetId: target.targetId,
        targetName: target.targetName ?? null,
        action: "deleted",
        count,
      },
    });
  }
  await tx.retentionRun.update({ where: { id: runId }, data: { deletedCount: { increment: count } } });
};
