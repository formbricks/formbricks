import type { JobSchedulerTemplateOptions, JobsOptions } from "bullmq";

export const JOBS_QUEUE_NAME = "background-jobs";
export const JOBS_PREFIX = "formbricks:jobs";

export const JOB_NAMES = {
  testLog: "system.test-log",
  responsePipeline: "response-pipeline.process",
  surveyScheduling: "survey-scheduling.reconcile",
} as const;

export const JOBS_DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000,
  },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60,
    count: 5000,
  },
};

export const JOBS_DEFAULT_JOB_SCHEDULER_TEMPLATE_OPTIONS: JobSchedulerTemplateOptions = {
  attempts: JOBS_DEFAULT_JOB_OPTIONS.attempts,
  backoff: JOBS_DEFAULT_JOB_OPTIONS.backoff,
  removeOnComplete: JOBS_DEFAULT_JOB_OPTIONS.removeOnComplete,
  removeOnFail: JOBS_DEFAULT_JOB_OPTIONS.removeOnFail,
};
