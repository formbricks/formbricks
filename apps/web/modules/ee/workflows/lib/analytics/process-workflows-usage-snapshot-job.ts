import "server-only";
import type { JobHandler, TWorkflowsUsageSnapshotJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { POSTHOG_KEY } from "@/lib/constants";
import { emitWorkflowUsageSnapshots } from "./usage-snapshot";

/**
 * Daily PostHog snapshot of workflow usage (ENG-2851). Lifecycle events say what changed; this says
 * what *is*: how many workflows each organization has in each status, which trigger and action types
 * they use, and the last day's run outcomes, so "active workflows" is a real time series rather than
 * something reconstructed from events that predate the instrumentation.
 *
 * Skipped outright without POSTHOG_KEY: the capture helpers would no-op anyway, but there is no
 * point paying for the read pass on an instance that reports to nobody. Idempotent and safe to
 * overlap in the sense recurring handlers must be: a second run in the same day emits the same
 * facts again, which is why the dashboards deduplicate these events per organization and day before
 * summing. Errors propagate so BullMQ retries with its default backoff.
 */
export const processWorkflowsUsageSnapshotJob: JobHandler<TWorkflowsUsageSnapshotJobData> = async (
  data,
  context
) => {
  const logContext = {
    attempt: context.attempt,
    jobId: context.jobId,
    jobName: context.jobName,
    maxAttempts: context.maxAttempts,
    queueName: context.queueName,
    scope: data.scope,
  };

  if (!POSTHOG_KEY) {
    logger.info(logContext, "Workflows usage snapshot skipped: PostHog is not configured");
    return;
  }

  logger.info(logContext, "Workflows usage snapshot job started");
  const summary = await emitWorkflowUsageSnapshots(new Date());
  logger.info({ ...logContext, ...summary }, "Workflows usage snapshot job completed");
};
