import type { JobSchedulerTemplateOptions, JobsOptions } from "bullmq";

export const JOBS_QUEUE_NAME = "background-jobs";
export const JOBS_PREFIX = "formbricks:jobs";

export const JOB_NAMES = {
  testLog: "system.test-log",
  responsePipeline: "response-pipeline.process",
  aiTranslation: "ai-translation.translate",
  surveyScheduling: "survey-scheduling.reconcile",
} as const;

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
