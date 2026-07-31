import "server-only";
import { logger } from "@formbricks/logger";
import { TFeedbackSourceWithMappings } from "@formbricks/types/feedback-source";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { createFeedbackRecordsBatch } from "@/modules/hub";
import { getFeedbackSourcesBySurveyId, updateFeedbackSource } from "./service";
import { transformResponseToFeedbackRecords } from "./transform";
import { getErrorMessage } from "./utils";

const logFailedRecords = (
  feedbackSourceId: string,
  results: Awaited<ReturnType<typeof createFeedbackRecordsBatch>>["results"]
): void => {
  for (const [index, result] of results.entries()) {
    if (!result.error) continue;
    logger.error(
      {
        feedbackSourceId,
        feedbackRecordIndex: index,
        error: {
          status: result.error.status,
          message: result.error.message,
          detail: result.error.detail,
        },
      },
      "Failed to create FeedbackRecord"
    );
  }
};

const processFeedbackSource = async (
  feedbackSource: TFeedbackSourceWithMappings,
  response: TResponse,
  survey: Pick<TSurvey, "id" | "name" | "blocks" | "languages">,
  workspaceId: string
): Promise<void> => {
  const feedbackRecords = transformResponseToFeedbackRecords(
    response,
    survey,
    feedbackSource.formbricksMappings,
    feedbackSource.feedbackDirectoryId
  );

  if (feedbackRecords.length === 0) {
    return;
  }

  const { results } = await createFeedbackRecordsBatch(feedbackRecords);

  const successes = results.filter((r) => r.data !== null).length;
  const failures = results.filter((r) => r.error !== null).length;

  if (failures > 0) {
    logger.warn(
      {
        feedbackSourceId: feedbackSource.id,
        surveyId: survey.id,
        responseId: response.id,
        successes,
        failures,
      },
      `FeedbackSource pipeline: ${failures}/${feedbackRecords.length} FeedbackRecords failed to send`
    );
    logFailedRecords(feedbackSource.id, results);
  } else {
    logger.info(
      {
        feedbackSourceId: feedbackSource.id,
        surveyId: survey.id,
        responseId: response.id,
        feedbackRecordsCreated: successes,
      },
      `FeedbackSource pipeline: Successfully sent ${successes} FeedbackRecords`
    );
  }

  if (successes > 0) {
    await updateFeedbackSource(feedbackSource.id, workspaceId, { lastSyncAt: new Date() });
  }
};

/**
 * Handle feedbackSource pipeline for a survey response
 *
 * This function is called from the pipeline when a response is created/finished.
 * It looks up active feedbackSources for the survey and sends the response data.
 *
 * @param response - The survey response
 * @param survey - The survey
 * @param workspaceId - The workspace ID (used as tenant_id)
 */
export const handleFeedbackSourcePipeline = async (
  response: TResponse,
  survey: Pick<TSurvey, "id" | "name" | "blocks" | "languages">,
  workspaceId: string
): Promise<void> => {
  try {
    const feedbackSources = await getFeedbackSourcesBySurveyId(survey.id);

    if (feedbackSources.length === 0) {
      return;
    }

    for (const feedbackSource of feedbackSources) {
      try {
        await processFeedbackSource(feedbackSource, response, survey, workspaceId);
      } catch (error) {
        logger.error(
          {
            feedbackSourceId: feedbackSource.id,
            surveyId: survey.id,
            responseId: response.id,
            error: getErrorMessage(error),
          },
          "FeedbackSource pipeline: Failed to process feedbackSource"
        );
      }
    }
  } catch (error) {
    logger.error(
      {
        surveyId: survey.id,
        responseId: response.id,
        error: getErrorMessage(error),
      },
      "FeedbackSource pipeline: Failed to handle feedbackSources"
    );
  }
};
