import "server-only";
import type { JobHandler, TUsageTelemetryJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { sendTelemetryEvents } from "@/lib/telemetry/usage-update";

/**
 * Sends the instance's usage update on a daily cron, independently of any survey traffic.
 *
 * Before this job the usage update was only ever sent from the response pipeline, so an instance that
 * identified itself against the license server but never collected a response reported no usage at all
 * (ENG-2107). The schedule is registered with `immediately: true`, so a run is also queued on each
 * boot — see `lib/jobs/recurring-registrations.ts` for why that, and not the daily slot alone, is what
 * gets an update out of an instance that barely runs.
 *
 * Safe to overlap, as recurring handlers must be: `sendTelemetryEvents` is guarded by an in-memory
 * check, a shared 24h timestamp in Redis and a distributed lock, so a second tick — or a response
 * pipeline run in the same window — is a no-op rather than a duplicate report. It also handles its own
 * failures, applying a 1h cooldown rather than throwing, so a rejected update normally leaves this job
 * successful and is retried on that cooldown instead of through BullMQ attempts.
 */
export const processUsageTelemetryJob: JobHandler<TUsageTelemetryJobData> = async (data, context) => {
  const logContext = {
    attempt: context.attempt,
    jobId: context.jobId,
    jobName: context.jobName,
    maxAttempts: context.maxAttempts,
    queueName: context.queueName,
    scope: data.scope,
  };

  logger.info(logContext, "Usage telemetry job started");

  await sendTelemetryEvents();

  logger.info(logContext, "Usage telemetry job completed");
};
