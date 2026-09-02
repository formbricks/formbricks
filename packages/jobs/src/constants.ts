import type { JobSchedulerTemplateOptions, JobsOptions } from "bullmq";

export const JOBS_QUEUE_NAME = "background-jobs";
export const JOBS_PREFIX = "{formbricks:jobs}";

export const JOB_NAMES = {
  authzedProjectionDelivery: "authzed-projection.deliver",
  authzedReconciliationAudit: "authzed-reconciliation.audit",
  testLog: "system.test-log",
  responsePipeline: "response-pipeline.process",
  surveyScheduling: "survey-scheduling.reconcile",
  surveyArchivePurge: "survey-archive-purge.process",
  webhookDelivery: "webhook-delivery.process",
  workflowRun: "workflow-run.process",
  workflowRunReconcile: "workflow-run.reconcile",
} as const;

/**
 * Retry policy for a single webhook delivery. Deliveries are fanned out one job per webhook, so this
 * budget belongs to one endpoint and never delays the rest of the pipeline. Five attempts with a 30 s
 * exponential base spread the retries over roughly 30 s, 1 min, 2 min and 4 min (~7.5 min total): long
 * enough to ride out a receiver restart or deploy, short enough that a dead endpoint stops costing us
 * within minutes. Permanent failures (SSRF rejection, 4xx other than 408/429) are raised as
 * `UnrecoverableError` by the handler and do not consume this budget.
 */
export const WEBHOOK_DELIVERY_JOB_OPTIONS = Object.freeze({
  attempts: 5,
  backoff: Object.freeze({
    type: "exponential",
    delay: 30_000,
  } as const),
}) satisfies JobsOptions;

const JOBS_DEFAULT_BACKOFF = Object.freeze({
  type: "exponential",
  delay: 5_000,
} as const);

const JOBS_DEFAULT_REMOVE_ON_COMPLETE = Object.freeze({
  age: 24 * 60 * 60,
  count: 1000,
} as const);

const JOBS_DEFAULT_REMOVE_ON_FAIL = Object.freeze({
  age: 7 * 24 * 60 * 60,
  count: 5000,
} as const);

export const JOBS_DEFAULT_JOB_OPTIONS = Object.freeze({
  attempts: 3,
  backoff: JOBS_DEFAULT_BACKOFF,
  removeOnComplete: JOBS_DEFAULT_REMOVE_ON_COMPLETE,
  removeOnFail: JOBS_DEFAULT_REMOVE_ON_FAIL,
}) satisfies JobsOptions;

export const JOBS_DEFAULT_JOB_SCHEDULER_TEMPLATE_OPTIONS = Object.freeze({
  attempts: JOBS_DEFAULT_JOB_OPTIONS.attempts,
  backoff: JOBS_DEFAULT_JOB_OPTIONS.backoff,
  removeOnComplete: JOBS_DEFAULT_JOB_OPTIONS.removeOnComplete,
  removeOnFail: JOBS_DEFAULT_JOB_OPTIONS.removeOnFail,
}) satisfies JobSchedulerTemplateOptions;
