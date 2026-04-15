import "server-only";
import { after } from "next/server";
import { type TResponsePipelineEvent, getBackgroundJobProducer } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import type { TResponse } from "@formbricks/types/responses";
import { getJobsQueueingConfig } from "@/lib/jobs/config";
import { getResponseSnapshotForPipeline } from "@/lib/response/service";

const RESPONSE_SNAPSHOT_RETRY_DELAYS_MS = [250, 1_000] as const;
const PIPELINE_ENQUEUE_RETRY_DELAYS_MS = [250, 1_000, 3_000] as const;

export interface EnqueueResponsePipelineEventsInput {
  environmentId: string;
  surveyId: string;
  responseId: string;
  events: TResponsePipelineEvent[];
  response?: TResponse;
}

const wait = async (delayMs: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
};

const toError = (error: unknown, fallbackMessage: string): Error =>
  error instanceof Error ? error : new Error(fallbackMessage);

const getPipelineLogContext = ({
  environmentId,
  events,
  responseId,
  surveyId,
}: Pick<EnqueueResponsePipelineEventsInput, "environmentId" | "events" | "responseId" | "surveyId">) => ({
  environmentId,
  events,
  responseId,
  surveyId,
});

const runWithRetry = async <T>({
  delaysMs,
  logContext,
  operation,
  operationLabel,
}: {
  delaysMs: readonly number[];
  logContext: Record<string, unknown>;
  operation: () => Promise<T>;
  operationLabel: string;
}): Promise<T> => {
  const maxAttempts = delaysMs.length + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw toError(error, `${operationLabel} failed`);
      }

      const retryDelayMs = delaysMs[attempt - 1];

      logger.warn(
        {
          ...logContext,
          attempt,
          err: error,
          maxAttempts,
          retryDelayMs,
        },
        `${operationLabel} failed; retrying`
      );

      await wait(retryDelayMs);
    }
  }

  throw new Error(`${operationLabel} failed`);
};

const hydrateResponseSnapshot = async ({
  environmentId,
  events,
  providedResponse,
  responseId,
  surveyId,
}: Pick<EnqueueResponsePipelineEventsInput, "environmentId" | "events" | "responseId" | "surveyId"> & {
  providedResponse?: TResponse;
}): Promise<TResponse> => {
  if (providedResponse) {
    if (providedResponse.id === responseId) {
      return providedResponse;
    }

    logger.warn(
      {
        environmentId,
        events,
        providedResponseId: providedResponse.id,
        responseId,
        surveyId,
      },
      "BullMQ response pipeline enqueue ignored a mismatched provided response snapshot"
    );
  }

  return await runWithRetry({
    delaysMs: RESPONSE_SNAPSHOT_RETRY_DELAYS_MS,
    logContext: getPipelineLogContext({ environmentId, events, responseId, surveyId }),
    operation: async () => {
      const response = await getResponseSnapshotForPipeline(responseId);

      if (!response) {
        throw new Error(`Response snapshot ${responseId} was not found for BullMQ response pipeline enqueue`);
      }

      return response;
    },
    operationLabel: "BullMQ response pipeline snapshot hydration",
  });
};

export const enqueueResponsePipelineEvents = async ({
  environmentId,
  surveyId,
  responseId,
  events,
  response: providedResponse,
}: EnqueueResponsePipelineEventsInput): Promise<void> => {
  const uniqueEvents = [...new Set(events)];

  if (uniqueEvents.length === 0) {
    return;
  }

  const queueingConfig = getJobsQueueingConfig();

  if (!queueingConfig.enabled) {
    logger.debug(
      getPipelineLogContext({
        environmentId,
        events: uniqueEvents,
        responseId,
        surveyId,
      }),
      "BullMQ response pipeline enqueue skipped"
    );
    return;
  }

  let response: TResponse;

  try {
    response = await hydrateResponseSnapshot({
      environmentId,
      events: uniqueEvents,
      providedResponse,
      responseId,
      surveyId,
    });
  } catch (error) {
    logger.error(
      {
        ...getPipelineLogContext({
          environmentId,
          events: uniqueEvents,
          responseId,
          surveyId,
        }),
        err: error,
      },
      "Failed to hydrate response snapshot for BullMQ response pipeline"
    );
    throw error;
  }

  const producer = getBackgroundJobProducer();
  const failedEvents: TResponsePipelineEvent[] = [];

  for (const event of uniqueEvents) {
    try {
      const job = await runWithRetry({
        delaysMs: PIPELINE_ENQUEUE_RETRY_DELAYS_MS,
        logContext: {
          ...getPipelineLogContext({
            environmentId,
            events: uniqueEvents,
            responseId,
            surveyId,
          }),
          event,
        },
        operation: async () =>
          await producer.enqueueResponsePipeline({
            environmentId,
            event,
            response,
            surveyId,
          }),
        operationLabel: "BullMQ response pipeline enqueue",
      });

      logger.debug(
        {
          environmentId,
          event,
          jobId: job.jobId,
          responseId,
          surveyId,
        },
        "BullMQ response pipeline job enqueued"
      );
    } catch (error) {
      failedEvents.push(event);
      logger.error(
        {
          environmentId,
          err: error,
          event,
          responseId,
          surveyId,
        },
        "Failed to enqueue BullMQ response pipeline job"
      );
    }
  }

  if (failedEvents.length > 0) {
    throw new AggregateError(
      failedEvents.map((event) => new Error(event)),
      `Failed to enqueue BullMQ response pipeline events: ${failedEvents.join(", ")}`
    );
  }
};

export const scheduleResponsePipelineEvents = (input: EnqueueResponsePipelineEventsInput): void => {
  after(async () => {
    try {
      await enqueueResponsePipelineEvents(input);
    } catch {
      // enqueueResponsePipelineEvents logs the final failure with context; avoid duplicate error logs here
    }
  });
};
