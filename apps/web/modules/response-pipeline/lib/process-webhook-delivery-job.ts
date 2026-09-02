import "server-only";
import { prisma } from "@formbricks/database";
import {
  type JobExecutionContext,
  type JobHandler,
  type TWebhookDeliveryJobData,
  UnrecoverableError,
} from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import { isDatabasePoolExhaustionError } from "@/lib/jobs/pool-exhaustion";
import { WebhookDnsResolutionError } from "@/lib/utils/validate-webhook-url";
import {
  WebhookDeliveryTimeoutError,
  getWebhookUrlHost,
  sendSignedWebhookRequest,
} from "@/modules/integrations/webhooks/lib/send-signed-webhook";
import { resolveStorageUrlsInObject } from "@/modules/storage/utils";
import { type TWebhookDeliveryOutcome, recordWebhookDeliveryOutcome } from "./webhook-delivery-metrics";

/**
 * The wire body. Byte-for-byte what the pipeline job sent before deliveries were fanned out — receivers
 * and their signature checks must not notice the refactor — so this shape is pinned by a parity test and
 * is not the place for new fields.
 */
export const buildWebhookDeliveryBody = (data: TWebhookDeliveryJobData): string =>
  JSON.stringify({
    webhookId: data.webhookId,
    event: data.event,
    data: {
      ...data.response,
      data: resolveStorageUrlsInObject(data.response.data),
      survey: {
        title: data.survey.name,
        type: data.survey.type,
        status: data.survey.status,
        createdAt: data.survey.createdAt,
        updatedAt: data.survey.updatedAt,
      },
    },
  });

/**
 * Receiver answered, but not with a success: worth another attempt only when the condition can change on
 * its own. 5xx, 408 and 429 are the receiver asking us to come back; a 3xx is a redirect we refuse to
 * follow (SSRF policy) and treat as a failure, but the target may fix its config. Every other 4xx means the
 * request itself is rejected — resending identical bytes cannot help.
 */
const isRetryableStatus = (statusCode: number): boolean =>
  statusCode >= 500 || statusCode === 408 || statusCode === 429 || (statusCode >= 300 && statusCode < 400);

const isSuccessStatus = (statusCode: number): boolean => statusCode >= 200 && statusCode < 300;

const getDeliveryLogContext = (data: TWebhookDeliveryJobData, context: JobExecutionContext) => ({
  attempt: context.attempt,
  event: data.event,
  jobId: context.jobId,
  jobName: context.jobName,
  maxAttempts: context.maxAttempts,
  queueName: context.queueName,
  responseId: data.response.id,
  surveyId: data.surveyId,
  webhookId: data.webhookId,
  workspaceId: data.workspaceId,
});

type TDeliveryLogContext = ReturnType<typeof getDeliveryLogContext>;

type TDeliveryTarget = {
  url: string;
  secret: string | null;
  workspaceId: string;
  triggers: string[];
  surveyIds: string[];
};

const loadDeliveryTarget = async (
  data: TWebhookDeliveryJobData,
  logContext: TDeliveryLogContext
): Promise<TDeliveryTarget | null> => {
  try {
    return await prisma.webhook.findUnique({
      where: { id: data.webhookId },
      select: { url: true, secret: true, workspaceId: true, triggers: true, surveyIds: true },
    });
  } catch (error) {
    // Counted like any other failed attempt: a database outage stops deliveries just as effectively as a
    // dead receiver, and a failure-rate alert that ignores it would stay green through the outage.
    recordWebhookDeliveryOutcome({ outcome: "load_failed", event: data.event });

    if (isDatabasePoolExhaustionError(error)) {
      logger.warn(
        { ...logContext, err: error, outcome: "load_failed" },
        "Webhook delivery hit database pool exhaustion and will be retried"
      );
    } else {
      logger.error(
        { ...logContext, err: error, outcome: "load_failed" },
        "Webhook delivery could not load the webhook and will be retried"
      );
    }
    throw error;
  }
};

/**
 * A webhook still receives an event only while it is subscribed to it. The pipeline job matched
 * `triggers`/`surveyIds` when it fanned out; re-checking here means a webhook the user unsubscribed or
 * re-scoped while this delivery was queued or retrying gets nothing. The workspace check cannot fail for
 * a row Prisma returned by id, but it costs nothing and turns a future bug into a skip instead of a leak.
 */
const isStillSubscribed = (target: TDeliveryTarget, data: TWebhookDeliveryJobData): boolean =>
  target.workspaceId === data.workspaceId &&
  target.triggers.includes(data.event) &&
  (target.surveyIds.length === 0 || target.surveyIds.includes(data.surveyId));

type TDeliveryAttempt = { kind: "completed"; statusCode: number } | { kind: "threw"; error: unknown };

const attemptDelivery = async (
  target: TDeliveryTarget,
  data: TWebhookDeliveryJobData
): Promise<TDeliveryAttempt> => {
  try {
    const { statusCode } = await sendSignedWebhookRequest({
      url: target.url,
      secret: target.secret,
      body: buildWebhookDeliveryBody(data),
      // Fixed at fan-out time from the pipeline job's id: identical on every attempt of this job, so
      // receivers can dedupe retries by `webhook-id` exactly as before the fan-out.
      messageId: data.webhookMessageId,
    });
    return { kind: "completed", statusCode };
  } catch (error) {
    return { kind: "threw", error };
  }
};

type TClassifiedFailure = {
  outcome: Extract<TWebhookDeliveryOutcome, "retryable_failure" | "permanent_failure">;
  reason: string;
  cause?: unknown;
};

const classifyFailure = (attempt: TDeliveryAttempt): TClassifiedFailure => {
  if (attempt.kind === "completed") {
    return isRetryableStatus(attempt.statusCode)
      ? { outcome: "retryable_failure", reason: `receiver responded with status ${attempt.statusCode}` }
      : {
          outcome: "permanent_failure",
          reason: `receiver rejected the request with status ${attempt.statusCode}`,
        };
  }

  const { error } = attempt;
  // Order matters: the DNS subclass is transient and must be matched before its InvalidInputError base.
  if (error instanceof WebhookDnsResolutionError) {
    return { outcome: "retryable_failure", reason: error.message, cause: error };
  }
  if (error instanceof InvalidInputError) {
    return { outcome: "permanent_failure", reason: error.message, cause: error };
  }
  if (error instanceof WebhookDeliveryTimeoutError) {
    return { outcome: "retryable_failure", reason: error.message, cause: error };
  }
  return {
    outcome: "retryable_failure",
    reason: error instanceof Error ? error.message : "unknown network error",
    cause: error,
  };
};

/**
 * Delivers one response event to one webhook. Enqueued by the response pipeline job, one job per
 * matching webhook, with its own retry budget (`WEBHOOK_DELIVERY_JOB_OPTIONS`).
 *
 * Outcome per attempt, in order of evaluation:
 * - the webhook row cannot be read → rethrow so BullMQ retries (`load_failed`)
 * - webhook row gone → complete (`skipped_deleted`); unsubscribed/re-scoped → complete (`skipped_rescoped`)
 * - 2xx → complete (`delivered`)
 * - SSRF/URL policy rejection or a 4xx other than 408/429 → `UnrecoverableError` (`permanent_failure`)
 * - anything else (network, timeout, DNS, 3xx, 408, 429, 5xx) → throw so BullMQ retries (`retryable_failure`)
 *
 * Every attempt emits exactly one outcome log line and one metric sample. Log context is scalar ids and
 * the URL's host only — webhook URLs routinely carry capability tokens, and the payload carries a survey
 * response, so neither may appear in a log line.
 */
export const processWebhookDeliveryJob: JobHandler<TWebhookDeliveryJobData> = async (data, context) => {
  const logContext = getDeliveryLogContext(data, context);

  const target = await loadDeliveryTarget(data, logContext);

  if (!target) {
    logger.info({ ...logContext, outcome: "skipped_deleted" }, "Webhook delivery skipped: webhook deleted");
    recordWebhookDeliveryOutcome({ outcome: "skipped_deleted", event: data.event });
    return;
  }

  if (!isStillSubscribed(target, data)) {
    logger.info(
      { ...logContext, outcome: "skipped_rescoped", webhookUrlHost: getWebhookUrlHost(target.url) },
      "Webhook delivery skipped: webhook no longer subscribed to this event"
    );
    recordWebhookDeliveryOutcome({ outcome: "skipped_rescoped", event: data.event });
    return;
  }

  const startedAt = Date.now();
  const attempt = await attemptDelivery(target, data);
  const durationMs = Date.now() - startedAt;
  const statusCode = attempt.kind === "completed" ? attempt.statusCode : undefined;
  const attemptLogContext = {
    ...logContext,
    durationMs,
    statusCode,
    webhookUrlHost: getWebhookUrlHost(target.url),
  };

  if (attempt.kind === "completed" && isSuccessStatus(attempt.statusCode)) {
    logger.info({ ...attemptLogContext, outcome: "delivered" }, "Webhook delivered");
    recordWebhookDeliveryOutcome({ outcome: "delivered", event: data.event, statusCode, durationMs });
    return;
  }

  const failure = classifyFailure(attempt);
  recordWebhookDeliveryOutcome({ outcome: failure.outcome, event: data.event, statusCode, durationMs });

  if (failure.outcome === "permanent_failure") {
    logger.error(
      { ...attemptLogContext, err: failure.cause, outcome: failure.outcome, reason: failure.reason },
      "Webhook delivery failed permanently"
    );
    throw new UnrecoverableError(`Webhook ${data.webhookId} delivery failed permanently: ${failure.reason}`);
  }

  const willRetry = context.attempt < context.maxAttempts;
  const failureLogContext = {
    ...attemptLogContext,
    err: failure.cause,
    outcome: failure.outcome,
    reason: failure.reason,
  };
  if (willRetry) {
    logger.warn(failureLogContext, "Webhook delivery failed; retry scheduled");
  } else {
    logger.error(failureLogContext, "Webhook delivery failed; retries exhausted");
  }
  throw new Error(`Webhook ${data.webhookId} delivery failed: ${failure.reason}`);
};
