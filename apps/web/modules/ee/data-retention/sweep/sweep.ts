import "server-only";
import { prisma } from "@formbricks/database";
import type { RetentionEntity } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { getIsDataRetentionEnabled } from "@/modules/ee/license-check/lib/utils";
import { RETENTION_RUN_BUDGET_MS, RETENTION_SWEEP_BUDGET_MS } from "./constants";
import { type TOpenedRetentionRun, closeRetentionRun, openRetentionRun } from "./run";
import { RetentionPolicyChangedError } from "./transaction";

/** What a policy's sweeper gets: its run (policy snapshot, clock, run id) and when to stop starting work. */
export type TRetentionSweepContext = TOpenedRetentionRun & { deadline: number };

/** One policy's work for one organisation. Records what it does on the run as it goes. */
export type TRetentionSweeper = (context: TRetentionSweepContext) => Promise<void>;

export type TRetentionSweepers = Partial<Record<RetentionEntity, TRetentionSweeper>>;

/** Responses first: their deletion doesn't depend on the survey still being live. */
const SWEEP_ORDER: readonly RetentionEntity[] = ["responses", "surveys", "members"];

export type TRetentionSweepSummary = {
  organizations: number;
  unlicensed: number;
  runs: number;
  failedRuns: number;
  /** Organisations left for the next night because the sweep's budget ran out. */
  deferred: number;
};

/**
 * The organisations with an enabled policy, least recently swept first, so a sweep that runs out of
 * budget leaves the ones it reached last night to the next.
 */
const listOrganizationsToSweep = async (): Promise<string[]> => {
  const rows = await prisma.$queryRaw<{ organizationId: string }[]>`
    SELECT o."organizationId"
    FROM (SELECT DISTINCT "organizationId" FROM "RetentionPolicy" WHERE "enabled") o
    LEFT JOIN LATERAL (
      SELECT r."startedAt" FROM "RetentionRun" r
      WHERE r."organizationId" = o."organizationId"
      ORDER BY r."startedAt" DESC
      LIMIT 1
    ) last ON true
    ORDER BY last."startedAt" ASC NULLS FIRST, o."organizationId"
  `;
  return rows.map((row) => row.organizationId);
};

/** A lookup that fails reads as unlicensed: the sweep never acts on a guess. */
const isLicensed = async (
  organizationId: string,
  check: (organizationId: string) => Promise<boolean>
): Promise<boolean> => {
  try {
    return await check(organizationId);
  } catch (error) {
    logger.error({ error, organizationId }, "Data retention licence check failed; skipping the organisation");
    return false;
  }
};

const auditWarningRestart = async (run: TOpenedRetentionRun): Promise<void> => {
  if (!run.restartedWarning) return;
  try {
    await queueAuditEventWithoutRequest({
      action: "updated",
      targetType: "retentionPolicy",
      targetId: run.policy.id,
      organizationId: run.policy.organizationId,
      userId: "system",
      userType: "system",
      status: "success",
      oldObject: { entity: run.policy.entity, enabledAt: run.restartedWarning.previousEnabledAt },
      newObject: { entity: run.policy.entity, enabledAt: run.policy.enabledAt },
    });
  } catch (error) {
    logger.error({ error, policyId: run.policy.id }, "Data retention warning restart audit failed");
  }
};

/** Run one policy for one organisation. Never throws: a failure closes the run and is logged. */
const sweepPolicy = async (
  organizationId: string,
  entity: RetentionEntity,
  sweeper: TRetentionSweeper
): Promise<"ran" | "failed" | "none"> => {
  const run = await openRetentionRun(organizationId, entity);
  if (!run) return "none";
  await auditWarningRestart(run);

  const logContext = { organizationId, entity, runId: run.runId };
  if (run.restartedWarning) {
    logger.info(logContext, "Data retention warning restarted after a gap in sweeps");
  }

  let outcome: "ran" | "failed" = "ran";
  try {
    await sweeper({ ...run, deadline: Date.now() + RETENTION_RUN_BUDGET_MS });
  } catch (error) {
    if (error instanceof RetentionPolicyChangedError) {
      logger.info(logContext, "Data retention policy changed during its run; stopped");
    } else {
      outcome = "failed";
      logger.error({ ...logContext, error }, "Data retention run failed");
    }
  } finally {
    await closeRetentionRun(run.runId);
  }
  return outcome;
};

/** Each policy of one licensed organisation, in turn, counted on the night's summary. */
const sweepOrganization = async (
  organizationId: string,
  sweepers: TRetentionSweepers,
  summary: TRetentionSweepSummary
): Promise<void> => {
  for (const entity of SWEEP_ORDER) {
    const sweeper = sweepers[entity];
    if (!sweeper) continue;
    const outcome = await sweepPolicy(organizationId, entity, sweeper);
    if (outcome !== "none") summary.runs += 1;
    if (outcome === "failed") summary.failedRuns += 1;
  }
};

/**
 * One night's sweep: every organisation with an enabled policy, each policy's run in turn. An
 * organisation without the licence (or whose licence lookup fails) is skipped and nothing of it is
 * touched; when it comes back, `openRetentionRun` restarts its warning first. One policy's failure closes
 * its run and the sweep carries on. Only an infrastructure failure (the database) fails the job.
 */
export const runDataRetentionSweep = async ({
  sweepers,
  checkLicence = getIsDataRetentionEnabled,
}: {
  sweepers: TRetentionSweepers;
  checkLicence?: (organizationId: string) => Promise<boolean>;
}): Promise<TRetentionSweepSummary> => {
  const deadline = Date.now() + RETENTION_SWEEP_BUDGET_MS;
  const organizationIds = await listOrganizationsToSweep();
  const summary: TRetentionSweepSummary = {
    organizations: 0,
    unlicensed: 0,
    runs: 0,
    failedRuns: 0,
    deferred: 0,
  };

  for (const [index, organizationId] of organizationIds.entries()) {
    if (Date.now() >= deadline) {
      summary.deferred = organizationIds.length - index;
      break;
    }
    summary.organizations += 1;
    if (await isLicensed(organizationId, checkLicence)) {
      await sweepOrganization(organizationId, sweepers, summary);
    } else {
      summary.unlicensed += 1;
    }
  }

  return summary;
};
