import type { ZodType } from "zod";
import type {
  TBackgroundJobScheduleIdentity,
  TRecurringBackgroundJobSchedule,
  TRunAtBackgroundJobSchedule,
} from "@/src/schedules";
import type {
  TResponsePipelineJobData,
  TSurveySchedulingJobData,
  TTestLogJobData,
  TWorkflowRunJobData,
  TWorkflowRunReconcileJobData,
} from "@/src/types";

export interface JobExecutionContext {
  attempt: number;
  jobId: string;
  jobName: string;
  maxAttempts: number;
  queueName: string;
}

export interface EnqueuedJob {
  jobId: string;
  jobName: string;
  queueName: string;
}

export interface UpsertedRecurringJobSchedule extends EnqueuedJob {
  scheduleId: string;
  scope: string;
}

export type JobHandler<TData> = (data: TData, context: JobExecutionContext) => Promise<void>;

export type JobHandlerOverrides = Partial<Record<string, JobHandler<unknown>>>;

export interface BackgroundJobDefinition<TData> {
  handle: JobHandler<TData>;
  name: string;
  schema: ZodType<TData>;
}

export interface AnyBackgroundJobDefinition {
  handle: JobHandler<unknown>;
  name: string;
  schema: ZodType;
}

export const toAnyBackgroundJobDefinition = <TData>(
  definition: BackgroundJobDefinition<TData>
): AnyBackgroundJobDefinition => ({
  handle: async (data, context) => {
    await definition.handle(data as TData, context);
  },
  name: definition.name,
  schema: definition.schema as ZodType,
});

export interface BackgroundJobProducer {
  enqueueResponsePipeline: (data: TResponsePipelineJobData) => Promise<EnqueuedJob>;
  enqueueSurveyScheduling: (data: TSurveySchedulingJobData) => Promise<EnqueuedJob>;
  enqueueTestLog: (data: TTestLogJobData) => Promise<EnqueuedJob>;
  enqueueWorkflowRun: (data: TWorkflowRunJobData, options?: { jobId: string }) => Promise<EnqueuedJob>;
  scheduleResponsePipelineAt: (
    schedule: TRunAtBackgroundJobSchedule,
    data: TResponsePipelineJobData
  ) => Promise<EnqueuedJob>;
  scheduleSurveySchedulingAt: (
    schedule: TRunAtBackgroundJobSchedule,
    data: TSurveySchedulingJobData
  ) => Promise<EnqueuedJob>;
  scheduleTestLogAt: (schedule: TRunAtBackgroundJobSchedule, data: TTestLogJobData) => Promise<EnqueuedJob>;
  upsertRecurringResponsePipelineSchedule: (
    identity: TBackgroundJobScheduleIdentity,
    schedule: TRecurringBackgroundJobSchedule,
    data: TResponsePipelineJobData
  ) => Promise<UpsertedRecurringJobSchedule>;
  upsertRecurringSurveySchedulingSchedule: (
    identity: TBackgroundJobScheduleIdentity,
    schedule: TRecurringBackgroundJobSchedule,
    data: TSurveySchedulingJobData
  ) => Promise<UpsertedRecurringJobSchedule>;
  upsertRecurringTestLogSchedule: (
    identity: TBackgroundJobScheduleIdentity,
    schedule: TRecurringBackgroundJobSchedule,
    data: TTestLogJobData
  ) => Promise<UpsertedRecurringJobSchedule>;
  upsertRecurringWorkflowRunReconcileSchedule: (
    identity: TBackgroundJobScheduleIdentity,
    schedule: TRecurringBackgroundJobSchedule,
    data: TWorkflowRunReconcileJobData
  ) => Promise<UpsertedRecurringJobSchedule>;
}
