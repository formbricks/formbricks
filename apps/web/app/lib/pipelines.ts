import "server-only";
import { type TResponsePipelineEvent, getBackgroundJobProducer } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import type { TResponse } from "@formbricks/types/responses";
import { getJobsQueueingConfig } from "@/lib/jobs/config";
import { getResponseSnapshotForPipeline } from "@/lib/response/service";

export interface EnqueueResponsePipelineEventsInput {
  environmentId: string;
  surveyId: string;
  responseId: string;
  events: TResponsePipelineEvent[];
  response?: TResponse;
}

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
      {
        environmentId,
        events: uniqueEvents,
        responseId,
        surveyId,
      },
      "BullMQ response pipeline enqueue skipped"
    );
    return;
  }

  let response = providedResponse;

  if (response && response.id !== responseId) {
    logger.warn(
      {
        environmentId,
        events: uniqueEvents,
        providedResponseId: response.id,
        responseId,
        surveyId,
      },
      "BullMQ response pipeline enqueue ignored a mismatched provided response snapshot"
    );
    response = undefined;
  }

  if (!response) {
    try {
      response = await getResponseSnapshotForPipeline(responseId);
    } catch (error) {
      logger.error(
        {
          environmentId,
          err: error,
          events: uniqueEvents,
          responseId,
          surveyId,
        },
        "Failed to hydrate response snapshot for BullMQ response pipeline"
      );
      return;
    }
  }

  if (!response) {
    logger.warn(
      {
        environmentId,
        events: uniqueEvents,
        responseId,
        surveyId,
      },
      "BullMQ response pipeline enqueue skipped because the response snapshot was not found"
    );
    return;
  }

  const producer = getBackgroundJobProducer();
  const enqueueResults = await Promise.allSettled(
    uniqueEvents.map(async (event) => {
      const job = await producer.enqueueResponsePipeline({
        environmentId,
        event,
        response,
        surveyId,
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
    })
  );

  enqueueResults.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.error(
        {
          environmentId,
          err: result.reason,
          event: uniqueEvents[index],
          responseId,
          surveyId,
        },
        "Failed to enqueue BullMQ response pipeline job"
      );
    }
  });
};
