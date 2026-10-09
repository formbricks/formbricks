import "server-only";
import { prisma } from "@formbricks/database";
import type { RetentionEntity } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { getIsDataRetentionEnabled } from "@/modules/ee/license-check/lib/utils";
import { RETENTION_RUN_BUDGET_MS, RETENTION_SWEEP_BUDGET_MS } from "./constants";
import { type TOpenedRetentionRun, closeRetentionRun, openRetentionRun } from "./run";
import { type TSurveyNoticeBatch, sendSurveyNotices } from "./survey-notices";
import { RetentionPolicyChangedError } from "./transaction";

/** What a policy's sweeper gets: its run (policy snapshot, clock, run id) and when to stop starting work. */
export type TRetentionSweepContext = TOpenedRetentionRun & { deadline: number };

/** What a policy will do tonight, once it has read what is due. */
export type TRetentionSweepPlan = {
  /**
   * Its survey notices. The responses and surveys policies' are sent together, one email per person a
   * night listing both.
   */
  surveyNotices?: TSurveyNoticeBatch;
  /** Its actions, after the night's notices, until `deadline`. Records what it does on the run. */
  act: (deadline: number) => Promise<void>;
};

/** One policy's work for one organisation: read what is due, and plan the night's notices and actions. */
export type TRetentionSweeper = (context: TRetentionSweepContext) => Promise<TRetentionSweepPlan>;

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

type TPolicyRun = {
  run: TOpenedRetentionRun;
  /** Null once the run stopped (the policy changed, or a step failed). */
  plan: TRetentionSweepPlan | null;
  failed: boolean;
};

/**
 * One step of a policy's run. A policy changed mid-run stops that run quietly; any other failure is
 * logged and fails it. Either way its later steps are skipped and the other policies carry on.
 */
const runStep = async (policyRun: TPolicyRun, step: () => Promise<void>): Promise<void> => {
  const logContext = {
    organizationId: policyRun.run.policy.organizationId,
    entity: policyRun.run.policy.entity,
    runId: policyRun.run.runId,
  };
  try {
    await step();
  } catch (error) {
    policyRun.plan = null;
    if (error instanceof RetentionPolicyChangedError) {
      logger.info(logContext, "Data retention policy changed during its run; stopped");
    } else {
      policyRun.failed = true;
      logger.error({ ...logContext, error }, "Data retention run failed");
    }
  }
};

/** Open one policy's run, restarting its warning first if it is due, or null when there is none. */
const startPolicyRun = async (
  organizationId: string,
  entity: RetentionEntity
): Promise<TPolicyRun | null> => {
  const run = await openRetentionRun(organizationId, entity);
  if (!run) return null;
  await auditWarningRestart(run);
  if (run.restartedWarning) {
    logger.info(
      { organizationId, entity, runId: run.runId },
      "Data retention warning restarted after a gap in sweeps"
    );
  }
  return { run, plan: null, failed: false };
};

/**
 * One licensed organisation's night, counted on the summary: every enabled policy reads what is due,
 * then the survey notices of the responses and surveys policies go out together (one email per person),
 * then each policy acts, each step within its own time budget. Every run is closed, whatever happened.
 */
const sweepOrganization = async (
  organizationId: string,
  sweepers: TRetentionSweepers,
  summary: TRetentionSweepSummary
): Promise<void> => {
  const policyRuns: TPolicyRun[] = [];
  try {
    for (const entity of SWEEP_ORDER) {
      const sweeper = sweepers[entity];
      if (!sweeper) continue;
      const policyRun = await startPolicyRun(organizationId, entity);
      if (!policyRun) continue;
      policyRuns.push(policyRun);
      await runStep(policyRun, async () => {
        policyRun.plan = await sweeper({ ...policyRun.run, deadline: Date.now() + RETENTION_RUN_BUDGET_MS });
      });
    }

    const noticeRuns = policyRuns.filter((policyRun) => policyRun.plan?.surveyNotices);
    if (noticeRuns.length > 0) {
      await sendSurveyNotices(
        noticeRuns.map((policyRun) => policyRun.plan!.surveyNotices!),
        Date.now() + RETENTION_RUN_BUDGET_MS
      ).catch((error: unknown) => {
        for (const policyRun of noticeRuns) {
          policyRun.plan = null;
          policyRun.failed = true;
        }
        logger.error({ error, organizationId }, "Data retention notices failed");
      });
    }

    for (const policyRun of policyRuns) {
      const plan = policyRun.plan;
      if (plan) await runStep(policyRun, () => plan.act(Date.now() + RETENTION_RUN_BUDGET_MS));
    }
  } finally {
    for (const policyRun of policyRuns) {
      await closeRetentionRun(policyRun.run.runId);
      summary.runs += 1;
      if (policyRun.failed) summary.failedRuns += 1;
    }
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
