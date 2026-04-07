import type { RepeatOptions } from "bullmq";
import { z } from "zod";

const ZValidDate = z.date().refine((value) => !Number.isNaN(value.getTime()), {
  message: "Invalid date",
});

const ZPositiveInteger = z.number().int().positive();
const MAX_RUN_AT_PAST_DRIFT_MS = 5_000;

const ZScheduleWindow = {
  endAt: ZValidDate.optional(),
  limit: ZPositiveInteger.optional(),
  startAt: ZValidDate.optional(),
} as const;

export const ZBackgroundJobScheduleId = z.string().trim().min(1);
export const ZBackgroundJobScheduleScope = z.string().trim().min(1);
export const ZBackgroundJobScheduleIdentity = z.object({
  scheduleId: ZBackgroundJobScheduleId,
  scope: ZBackgroundJobScheduleScope,
});

export type TBackgroundJobScheduleIdentity = z.infer<typeof ZBackgroundJobScheduleIdentity>;

export const ZRunAtBackgroundJobSchedule = z.object({
  runAt: ZValidDate,
});

export type TRunAtBackgroundJobSchedule = z.infer<typeof ZRunAtBackgroundJobSchedule>;

export const ZRecurringEveryBackgroundJobSchedule = z
  .object({
    ...ZScheduleWindow,
    everyMs: ZPositiveInteger,
    kind: z.literal("every"),
  })
  .refine((value) => !value.startAt || !value.endAt || value.endAt.getTime() > value.startAt.getTime(), {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });

export const ZRecurringCronBackgroundJobSchedule = z
  .object({
    ...ZScheduleWindow,
    cronPattern: z.string().trim().min(1),
    immediately: z.boolean().optional(),
    kind: z.literal("cron"),
    timeZone: z.string().trim().min(1).optional(),
  })
  .refine((value) => !value.startAt || !value.endAt || value.endAt.getTime() > value.startAt.getTime(), {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });

export const ZRecurringBackgroundJobSchedule = z.discriminatedUnion("kind", [
  ZRecurringEveryBackgroundJobSchedule,
  ZRecurringCronBackgroundJobSchedule,
]);

export type TRecurringBackgroundJobSchedule = z.infer<typeof ZRecurringBackgroundJobSchedule>;

export const getDelayForRunAtSchedule = (schedule: TRunAtBackgroundJobSchedule, now = new Date()): number => {
  const parsedSchedule = ZRunAtBackgroundJobSchedule.parse(schedule);
  const delay = parsedSchedule.runAt.getTime() - now.getTime();

  if (delay < 0) {
    if (Math.abs(delay) <= MAX_RUN_AT_PAST_DRIFT_MS) {
      return 0;
    }

    throw new Error("Background job runAt is too far in the past");
  }

  return delay;
};

export const toBullMQRepeatOptions = (
  schedule: TRecurringBackgroundJobSchedule
): Omit<RepeatOptions, "key"> => {
  const parsedSchedule = ZRecurringBackgroundJobSchedule.parse(schedule);

  if (parsedSchedule.kind === "every") {
    return {
      endDate: parsedSchedule.endAt,
      every: parsedSchedule.everyMs,
      limit: parsedSchedule.limit,
      startDate: parsedSchedule.startAt,
    };
  }

  return {
    endDate: parsedSchedule.endAt,
    immediately: parsedSchedule.immediately,
    limit: parsedSchedule.limit,
    pattern: parsedSchedule.cronPattern,
    startDate: parsedSchedule.startAt,
    tz: parsedSchedule.timeZone,
  };
};

export const getRecurringJobSchedulerId = (
  jobName: string,
  identity: TBackgroundJobScheduleIdentity
): string => {
  const parsedIdentity = ZBackgroundJobScheduleIdentity.parse(identity);

  return `${jobName}:${parsedIdentity.scope}:${parsedIdentity.scheduleId}`;
};
