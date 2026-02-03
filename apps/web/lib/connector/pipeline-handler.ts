import "server-only";
import { logger } from "@formbricks/logger";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { createFeedbackRecordsBatch } from "./hub-client";
import { getConnectorsBySurveyId, updateConnector } from "./service";
import { transformResponseToFeedbackRecords } from "./transform";

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
export async function handleConnectorPipeline(
  response: TResponse,
  survey: TSurvey,
  environmentId: string
): Promise<void> {
  try {
    // Get all active Formbricks connectors for this survey
    const connectors = await getConnectorsBySurveyId(survey.id);

    if (connectors.length === 0) {
      // No connectors configured for this survey
      return;
    }

    // Process each connector
    for (const connector of connectors) {
      try {
        // Transform response to FeedbackRecords using the connector's mappings
        const feedbackRecords = transformResponseToFeedbackRecords(
          response,
          survey,
          connector.formbricksMappings,
          environmentId // Use environment ID as tenant_id
        );

        if (feedbackRecords.length === 0) {
          // No mapped elements had values in this response
          continue;
        }

        // Send to Hub API
        const { results } = await createFeedbackRecordsBatch(feedbackRecords);

        // Count successes and failures
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

          // Log the specific errors
          results.forEach((result, index) => {
            if (result.error) {
              logger.error(
                {
                  connectorId: connector.id,
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
          });

          // Update connector with error message if all failed
          if (successes === 0) {
            await updateConnector(connector.id, {
              errorMessage: `Failed to send FeedbackRecords to Hub: ${results[0].error?.message || "Unknown error"}`,
            });
          }
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

          // Clear any previous error and update lastSyncAt
          await updateConnector(connector.id, {
            errorMessage: null,
            lastSyncAt: new Date(),
          });
        }
      } catch (error) {
        logger.error(
          {
            connectorId: connector.id,
            surveyId: survey.id,
            responseId: response.id,
            error: error instanceof Error ? error.message : "Unknown error",
          },
          "Connector pipeline: Failed to process connector"
        );

        // Update connector with error
        await updateConnector(connector.id, {
          status: "error",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  } catch (error) {
    // Log but don't throw - we don't want to break the main pipeline
    logger.error(
      {
        surveyId: survey.id,
        responseId: response.id,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Connector pipeline: Failed to handle connectors"
    );
  }
}
