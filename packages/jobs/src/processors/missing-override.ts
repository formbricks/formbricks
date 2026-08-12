import { logger } from "@formbricks/logger";
import type { JobHandler } from "@/src/contracts";

/** Scalar identifiers safe to put in a log line. */
type TLogDetails = Record<string, string | number | boolean | undefined>;

/**
 * Builds the packaged fallback handler for a job whose real implementation lives in `apps/web` and is
 * wired as a runtime override (see `jobHandlerOverrides`). It only runs when no override is registered,
 * so it logs and throws instead of silently dropping the job: a missing override is a deploy bug, not
 * an operational fact — unlike an unknown job name, which the registry logs and drops.
 *
 * `describeData` must return **scalar identifiers only**. Never log the payload itself, and never
 * spread it: a response-pipeline job carries a full survey response (answers, contact attributes,
 * metadata) and these logs reach Sentry. Jobs with no useful identifier omit it entirely.
 */
export const createMissingOverrideHandler =
  <TData>(label: string, describeData?: (data: TData) => TLogDetails): JobHandler<TData> =>
  (data, context) => {
    logger.error(
      {
        ...describeData?.(data),
        attempt: context.attempt,
        jobId: context.jobId,
        jobName: context.jobName,
        queueName: context.queueName,
      },
      `BullMQ ${label} processor override is not registered`
    );

    throw new Error(`BullMQ ${label} processor override missing for job ${context.jobId}`);
  };
