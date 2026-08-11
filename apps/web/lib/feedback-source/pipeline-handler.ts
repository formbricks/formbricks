import "server-only";
import { logger } from "@formbricks/logger";
import { TFeedbackSourceWithMappings } from "@formbricks/types/feedback-source";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { type TReconcileFailure, reconcileFeedbackRecords } from "./reconcile";
import { getFeedbackSourcesBySurveyId, updateFeedbackSource } from "./service";
import { transformResponseToFeedbackRecords } from "./transform";
import { getErrorMessage } from "./utils";

/**
 * Per-record failure detail, at debug.
 *
 * Debug, not error: the Hub service layer already warned per record with the full error, and the
 * caller warns once with the failure count. At error level a single Hub outage reported itself
 * three times per record and looked like an unhandled fault, when the pipeline handles it. Note the
 * default level is warn in production and info in dev, so this is off in both unless
 * LOG_LEVEL=debug — the per-record index it adds is opt-in, and the warn above is what you
 * normally see. Pinned by a test; the levels are an operator-visible contract (ENG-1916).
 */
const logFailedRecords = (feedbackSourceId: string, failures: TReconcileFailure[]): void => {
  for (const failure of failures) {
    logger.debug(
      {
        feedbackSourceId,
        feedbackRecordIndex: failure.index,
        error: failure.error,
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

  // Reconciling rather than blind-creating: a response already ingested as a partial (historical
  // import with importMode "all") would otherwise 409 on every field it already has, leaving Hub
  // holding the partial answer and logging each conflict as an error.
  const { created, reconciled, superseded, failures } = await reconcileFeedbackRecords(
    feedbackRecords,
    feedbackSource.feedbackDirectoryId
  );

  // No snapshotAt is passed from here on purpose: this path runs on responseFinished with data read
  // moments ago, so it is the freshest writer and should never defer. `superseded` is therefore
  // expected to stay 0 here, but it is counted rather than dropped so the totals always add up.
  const successes = created + reconciled + superseded;

  if (failures.length > 0) {
    logger.warn(
      {
        feedbackSourceId: feedbackSource.id,
        surveyId: survey.id,
        responseId: response.id,
        created,
        reconciled,
        successes,
        failures: failures.length,
      },
      `FeedbackSource pipeline: ${failures.length}/${feedbackRecords.length} FeedbackRecords failed to send`
    );
    logFailedRecords(feedbackSource.id, failures);
  } else {
    logger.info(
      {
        feedbackSourceId: feedbackSource.id,
        surveyId: survey.id,
        responseId: response.id,
        created,
        reconciled,
        successes,
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
