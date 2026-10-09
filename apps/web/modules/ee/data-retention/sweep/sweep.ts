import "server-only";
import { prisma } from "@formbricks/database";
import type { RetentionEntity } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { mapWithConcurrency } from "@/lib/utils/map-with-concurrency";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { getIsDataRetentionEnabled } from "@/modules/ee/license-check/lib/utils";
import { RETENTION_RUN_BUDGET_MS, RETENTION_SWEEP_BUDGET_MS } from "./constants";
import {
  type TOpenedRetentionRun,
  closeRetentionRun,
  openRetentionRuns,
  recordRetentionDeferral,
} from "./run";
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

/**
 * The policies whose notices are survey notices, sent together after both have read what is due. The
 * others read what is due only after those notices went out, so the recipients chosen for the survey
 * notices are as fresh as they can be when the email leaves (the members policy may take its time).
 */
const SURVEY_NOTICE_ENTITIES: ReadonlySet<RetentionEntity> = new Set(["responses", "surveys"]);

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

/** How many licence lookups run at once when marking the organisations a night had no time for. */
const DEFERRAL_LICENCE_CHECK_CONCURRENCY = 8;

/**
 * Record that the night ran out of time for these organisations (`recordRetentionDeferral`), the
 * licensed ones only, so a backlog of organisations never restarts their warnings. A failure is logged,
 * not thrown: the cost is a warning restarting after three such nights, which only delays action.
 */
const markDeferred = async (
  organizationIds: readonly string[],
  checkLicence: (organizationId: string) => Promise<boolean>
): Promise<void> => {
  try {
    const licensed = await mapWithConcurrency(
      organizationIds,
      DEFERRAL_LICENCE_CHECK_CONCURRENCY,
      async (organizationId) => ((await isLicensed(organizationId, checkLicence)) ? organizationId : null)
    );
    await recordRetentionDeferral(licensed.filter((id): id is string => id !== null));
  } catch (error) {
    logger.error(
      { error, deferred: organizationIds.length },
      "Failed to record the organisations the data retention sweep had no time for"
    );
  }
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

/** One policy's run, set up once its organisation's runs are open: its warning restart audited. */
const startPolicyRun = async (run: TOpenedRetentionRun): Promise<TPolicyRun> => {
  await auditWarningRestart(run);
  if (run.restartedWarning) {
    logger.info(
      { organizationId: run.policy.organizationId, entity: run.policy.entity, runId: run.runId },
      "Data retention warning restarted after a gap in sweeps"
    );
  }
  return { run, plan: null, failed: false };
};

/** Each policy reads what is due and plans its night, in turn, each within its own time budget. */
const prepare = async (policyRuns: readonly TPolicyRun[], sweepers: TRetentionSweepers): Promise<void> => {
  for (const policyRun of policyRuns) {
    const sweeper = sweepers[policyRun.run.policy.entity];
    if (!sweeper) continue;
    await runStep(policyRun, async () => {
      policyRun.plan = await sweeper({ ...policyRun.run, deadline: Date.now() + RETENTION_RUN_BUDGET_MS });
    });
  }
};

/**
 * Send the survey notices of the policies that have them, one email per person across both. A policy
 * changed before its notices were claimed is stopped there: no actions on its run either. If sending
 * fails, every policy in it fails and acts on nothing.
 */
const sendNotices = async (organizationId: string, policyRuns: readonly TPolicyRun[]): Promise<void> => {
  const noticeRuns = policyRuns.filter((policyRun) => policyRun.plan?.surveyNotices);
  if (noticeRuns.length === 0) return;
  try {
    const { changed } = await sendSurveyNotices(
      organizationId,
      noticeRuns.map((policyRun) => policyRun.plan!.surveyNotices!),
      Date.now() + RETENTION_RUN_BUDGET_MS
    );
    const changedEntities: readonly RetentionEntity[] = changed;
    for (const policyRun of noticeRuns) {
      if (changedEntities.includes(policyRun.run.policy.entity)) policyRun.plan = null;
    }
  } catch (error) {
    for (const policyRun of noticeRuns) {
      policyRun.plan = null;
      policyRun.failed = true;
    }
    logger.error({ error, organizationId }, "Data retention notices failed");
  }
};

/**
 * One licensed organisation's night, counted on the summary. Its runs open together
 * (`openRetentionRuns`), or none do when another sweep holds the organisation; a failure to open them
 * skips this organisation only. Then the survey policies read what is due, their notices go out
 * together (one email per person), the other policies read what is due, and each policy acts, each step
 * within its own time budget. Every run is closed, whatever happened.
 */
const sweepOrganization = async (
  organizationId: string,
  sweepers: TRetentionSweepers,
  summary: TRetentionSweepSummary
): Promise<void> => {
  const entities = SWEEP_ORDER.filter((entity) => sweepers[entity]);
  if (entities.length === 0) return;
  let runs: TOpenedRetentionRun[];
  try {
    runs = await openRetentionRuns(organizationId, entities);
  } catch (error) {
    logger.error(
      { error, organizationId },
      "Data retention runs could not be opened; skipping the organisation"
    );
    return;
  }

  const policyRuns: TPolicyRun[] = [];
  try {
    for (const run of runs) policyRuns.push(await startPolicyRun(run));
    const sendsSurveyNotices = (policyRun: TPolicyRun) =>
      SURVEY_NOTICE_ENTITIES.has(policyRun.run.policy.entity);

    await prepare(policyRuns.filter(sendsSurveyNotices), sweepers);
    await sendNotices(organizationId, policyRuns);
    await prepare(
      policyRuns.filter((policyRun) => !sendsSurveyNotices(policyRun)),
      sweepers
    );

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
 * touched; when it comes back, `openRetentionRuns` restarts its warning first. One policy's failure
 * closes its run, and an organisation whose runs can't be opened is skipped; the sweep carries on. Only
 * an infrastructure failure past that (closing a run) fails the job.
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
      const deferred = organizationIds.slice(index);
      summary.deferred = deferred.length;
      await markDeferred(deferred, checkLicence);
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
