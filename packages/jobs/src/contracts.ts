import type { ZodType } from "zod";
import type {
  TBackgroundJobScheduleIdentity,
  TRecurringBackgroundJobSchedule,
  TRunAtBackgroundJobSchedule,
} from "@/src/schedules";
import type { TTestLogJobData } from "@/src/types";

export interface JobExecutionContext {
  attempt: number;
  jobId: string;
  jobName: string;
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
  enqueueTestLog: (data: TTestLogJobData) => Promise<EnqueuedJob>;
  scheduleTestLogAt: (schedule: TRunAtBackgroundJobSchedule, data: TTestLogJobData) => Promise<EnqueuedJob>;
  upsertRecurringTestLogSchedule: (
    identity: TBackgroundJobScheduleIdentity,
    schedule: TRecurringBackgroundJobSchedule,
    data: TTestLogJobData
  ) => Promise<UpsertedRecurringJobSchedule>;
}
