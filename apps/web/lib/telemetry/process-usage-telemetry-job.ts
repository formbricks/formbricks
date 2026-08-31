import "server-only";
import type { JobHandler, TUsageTelemetryJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { sendTelemetryEvents } from "@/lib/telemetry/usage-update";

/**
 * Sends the instance's usage update on a daily cron, independently of any survey traffic.
 *
 * Before this job the usage update was only ever sent from the response pipeline, so an instance that
 * identified itself against the license server but never collected a response reported no usage at all
 * (ENG-2107). An instance that is not up at 02:15 UTC still reports: a missed tick is re-added with
 * its original timestamp and runs at the next boot — see `lib/jobs/recurring-registrations.ts`, which
 * also explains why `immediately: true` fires once per scheduler rather than on every boot.
 *
 * Safe to overlap, as recurring handlers must be: `sendTelemetryEvents` is guarded by an in-memory
 * check, a shared 24h timestamp in Redis and a distributed lock, so a second tick — or a response
 * pipeline run in the same window — is a no-op rather than a duplicate report. It also handles its own
 * failures rather than throwing, so a rejected update leaves this job successful; the 1h cooldown it
 * sets is a floor on the next attempt, not a scheduled retry, so the retry is whichever trigger calls
 * in next (a response, the next daily tick, or that tick overdue at boot) rather than a BullMQ attempt.
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
