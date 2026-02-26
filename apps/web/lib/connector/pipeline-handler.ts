import "server-only";
import { logger } from "@formbricks/logger";
import { TConnectorWithMappings } from "@formbricks/types/connector";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { createFeedbackRecordsBatch } from "@/modules/hub";
import { getConnectorsBySurveyId, updateConnector } from "./service";
import { transformResponseToFeedbackRecords } from "./transform";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

const logFailedRecords = (
  connectorId: string,
  results: Awaited<ReturnType<typeof createFeedbackRecordsBatch>>["results"]
): void => {
  for (const [index, result] of results.entries()) {
    if (!result.error) continue;
    logger.error(
      {
        connectorId,
        feedbackRecordIndex: index,
        error: {
          status: result.error.status,
          message: result.error.message,
          detail: result.error.detail,
        },
      },
      "Failed to create FeedbackRecord in Hub"
    );
  }
};

const processConnector = async (
  connector: TConnectorWithMappings,
  response: TResponse,
  survey: TSurvey,
  environmentId: string
): Promise<void> => {
  const feedbackRecords = transformResponseToFeedbackRecords(
    response,
    survey,
    connector.formbricksMappings,
    environmentId
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
        connectorId: connector.id,
        surveyId: survey.id,
        responseId: response.id,
        successes,
        failures,
      },
      `Connector pipeline: ${failures}/${feedbackRecords.length} FeedbackRecords failed to send`
    );
    logFailedRecords(connector.id, results);
  } else {
    logger.info(
      {
        connectorId: connector.id,
        surveyId: survey.id,
        responseId: response.id,
        feedbackRecordsCreated: successes,
      },
      `Connector pipeline: Successfully sent ${successes} FeedbackRecords to Hub`
    );
  }

  if (successes > 0) {
    await updateConnector(connector.id, environmentId, { lastSyncAt: new Date() });
  }
};

/**
 * Handle connector pipeline for a survey response
 *
 * This function is called from the pipeline when a response is created/finished.
 * It looks up active connectors for the survey and sends the response data to the Hub.
 *
 * @param response - The survey response
 * @param survey - The survey
 * @param environmentId - The environment ID (used as tenant_id)
 */
export const handleConnectorPipeline = async (
  response: TResponse,
  survey: TSurvey,
  environmentId: string
): Promise<void> => {
  try {
    const connectors = await getConnectorsBySurveyId(survey.id);

    if (connectors.length === 0) {
      return;
    }

    for (const connector of connectors) {
      try {
        await processConnector(connector, response, survey, environmentId);
      } catch (error) {
        logger.error(
          {
            connectorId: connector.id,
            surveyId: survey.id,
            responseId: response.id,
            error: getErrorMessage(error),
          },
          "Connector pipeline: Failed to process connector"
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
      "Connector pipeline: Failed to handle connectors"
    );
  }
};
