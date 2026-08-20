import {
  type JobHandler,
  type JobHandlerOverrides,
  ONE_SHOT_JOB_NAMES,
  type RecurringJobHandle,
  type TGlobalScopeJobData,
  type TRecurringBackgroundJobSchedule,
  type TRecurringJobKey,
  type TResponsePipelineJobData,
  type TWorkflowRunJobData,
  recurringJobs,
} from "@formbricks/jobs";
import { USAGE_TELEMETRY_DAILY_CRON_PATTERN, USAGE_TELEMETRY_TIME_ZONE } from "@/lib/telemetry/constants";
import { processUsageTelemetryJob } from "@/lib/telemetry/process-usage-telemetry-job";
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
 *
 * Keyed by `TRecurringJobKey` deliberately: declaring a new job in `recurringJobDescriptors` without
 * adding it here is then a build error rather than a job that quietly never runs — its schedule would
 * never be upserted and its handler never registered.
 *
 * The key only forces an entry to *exist*; pairing a key with another job's handle still type-checks,
 * and would be worse than a swap (both entries upsert the same scheduler, so one job's schedule is never
 * registered at all). A test pins the pairing instead.
 */
export const RECURRING_JOB_REGISTRATIONS_BY_KEY: Record<TRecurringJobKey, RecurringJobRegistration> = {
  surveyArchivePurge: {
    handler: processSurveyArchivePurgeJob,
    job: recurringJobs.surveyArchivePurge,
    schedule: {
      cronPattern: SURVEY_ARCHIVE_PURGE_DAILY_CRON_PATTERN,
      kind: "cron",
      timeZone: SURVEY_ARCHIVE_PURGE_TIME_ZONE,
    },
  },
  surveyScheduling: {
    handler: processSurveySchedulingJob,
    job: recurringJobs.surveyScheduling,
    schedule: {
      cronPattern: SURVEY_SCHEDULING_DAILY_CRON_PATTERN,
      kind: "cron",
      timeZone: SURVEY_SCHEDULING_TIME_ZONE,
    },
  },
  usageTelemetry: {
    handler: processUsageTelemetryJob,
    job: recurringJobs.usageTelemetry,
    schedule: {
      cronPattern: USAGE_TELEMETRY_DAILY_CRON_PATTERN,
      // The daily pattern keeps a long-running instance reporting; `immediately` is what covers an
      // instance that is *not* up at 02:15 UTC, which is the case the GTM need calls out — an instance
      // may be identified and then barely run (ENG-2107).
      //
      // It applies per upsert, not once per scheduler: BullMQ's repeat strategy returns "now" whenever
      // `immediately` is set, and `immediately` is stripped from the persisted repeat options, so every
      // boot queues one run and the iterations after it follow the cron pattern. That is deliberate —
      // a boot is the one moment an otherwise-idle instance is guaranteed to be able to report. It is
      // also cheap: `sendTelemetryEvents` is gated on a shared 24h timestamp in Redis, so the extra run
      // is a single Redis read whenever an update already went out.
      immediately: true,
      kind: "cron",
      timeZone: USAGE_TELEMETRY_TIME_ZONE,
    },
  },
  workflowRunReconcile: {
    handler: processWorkflowRunReconcileJob,
    job: recurringJobs.workflowRunReconcile,
    schedule: {
      everyMs: WORKFLOW_RUN_RECONCILE_INTERVAL_MS,
      kind: "every",
    },
  },
};

export const RECURRING_JOB_REGISTRATIONS: readonly RecurringJobRegistration[] = Object.values(
  RECURRING_JOB_REGISTRATIONS_BY_KEY
);

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
