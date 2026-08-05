import {
  ONE_SHOT_JOB_NAMES,
  type JobHandler,
  type JobHandlerOverrides,
  type RecurringJobHandle,
  type TGlobalScopeJobData,
  type TRecurringBackgroundJobSchedule,
  type TResponsePipelineJobData,
  type TWorkflowRunJobData,
  recurringJobs,
} from "@formbricks/jobs";
import { processWorkflowRunJob } from "@/modules/ee/workflows/lib/runner/process-workflow-run-job";
import { processWorkflowRunReconcileJob } from "@/modules/ee/workflows/lib/runner/process-workflow-run-reconcile-job";
import { WORKFLOW_RUN_RECONCILE_INTERVAL_MS } from "@/modules/ee/workflows/lib/runner/reconcile-constants";
import { processResponsePipelineJob } from "@/modules/response-pipeline/lib/process-response-pipeline-job";
import {
  SURVEY_ARCHIVE_PURGE_DAILY_CRON_PATTERN,
  SURVEY_ARCHIVE_PURGE_TIME_ZONE,
} from "@/modules/survey/archive/lib/constants";
import { processSurveyArchivePurgeJob } from "@/modules/survey/archive/lib/process-survey-archive-purge-job";
import {
  SURVEY_SCHEDULING_DAILY_CRON_PATTERN,
  SURVEY_SCHEDULING_TIME_ZONE,
} from "@/modules/survey/scheduling/lib/constants";
import { processSurveySchedulingJob } from "@/modules/survey/scheduling/lib/process-survey-scheduling-job";

/**
 * Adapts an app handler to the worker's override signature. The worker validates the payload against
 * the job's schema before dispatching, so this is the single place where that already-checked value is
 * narrowed — rather than one unchecked cast per job.
 */
const toJobHandlerOverride =
  <TData>(handler: JobHandler<TData>): NonNullable<JobHandlerOverrides[string]> =>
  async (data, context) => {
    await handler(data as TData, context);
  };

interface RecurringJobRegistration {
  handler: JobHandler<TGlobalScopeJobData>;
  job: RecurringJobHandle;
  schedule: TRecurringBackgroundJobSchedule;
}

/**
 * The app's half of each recurring job: when it runs (env-derived timing) and what runs. The job name,
 * schedule identity and payload live with the declaration in `@formbricks/jobs`, so neither the name nor
 * the identity is ever spelled out here — which is what keeps the schedule and its handler in step.
 */
export const RECURRING_JOB_REGISTRATIONS: readonly RecurringJobRegistration[] = [
  {
    handler: processSurveySchedulingJob,
    job: recurringJobs.surveyScheduling,
    schedule: {
      cronPattern: SURVEY_SCHEDULING_DAILY_CRON_PATTERN,
      kind: "cron",
      timeZone: SURVEY_SCHEDULING_TIME_ZONE,
    },
  },
  {
    handler: processSurveyArchivePurgeJob,
    job: recurringJobs.surveyArchivePurge,
    schedule: {
      cronPattern: SURVEY_ARCHIVE_PURGE_DAILY_CRON_PATTERN,
      kind: "cron",
      timeZone: SURVEY_ARCHIVE_PURGE_TIME_ZONE,
    },
  },
  {
    handler: processWorkflowRunReconcileJob,
    job: recurringJobs.workflowRunReconcile,
    schedule: {
      everyMs: WORKFLOW_RUN_RECONCILE_INTERVAL_MS,
      kind: "every",
    },
  },
];

/** Handler overrides for every job whose real implementation lives in this app. */
export const getJobHandlerOverrides = (): JobHandlerOverrides => ({
  [ONE_SHOT_JOB_NAMES.responsePipeline]:
    toJobHandlerOverride<TResponsePipelineJobData>(processResponsePipelineJob),
  [ONE_SHOT_JOB_NAMES.workflowRun]: toJobHandlerOverride<TWorkflowRunJobData>(processWorkflowRunJob),
  ...Object.fromEntries(
    RECURRING_JOB_REGISTRATIONS.map((registration) => [
      registration.job.name,
      toJobHandlerOverride(registration.handler),
    ])
  ),
});
