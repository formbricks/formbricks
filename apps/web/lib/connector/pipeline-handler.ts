import "server-only";
import FormbricksHub from "@formbricks/hub";
import { logger } from "@formbricks/logger";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { env } from "@/lib/env";
import { getConnectorsBySurveyId, updateConnector } from "./service";
import { transformResponseToFeedbackRecords } from "./transform";

type FeedbackRecordCreateParams = FormbricksHub.FeedbackRecordCreateParams;
type FeedbackRecordData = FormbricksHub.FeedbackRecordData;

function getHubClient(): FormbricksHub | null {
  const apiKey = env.HUB_API_KEY;
  if (!apiKey) return null;
  return new FormbricksHub({
    apiKey,
    baseURL: env.HUB_API_URL ?? undefined,
  });
}

async function createFeedbackRecordsBatch(inputs: FeedbackRecordCreateParams[]): Promise<{
  results: Array<{
    data: FeedbackRecordData | null;
    error: { status: number; message: string; detail: string } | null;
  }>;
}> {
  const client = getHubClient();
  const errorNoConfig = {
    status: 0,
    message: "HUB_API_KEY is not set; Hub integration is disabled.",
    detail: "HUB_API_KEY is not set; Hub integration is disabled.",
  };

  if (!client) {
    return {
      results: inputs.map(() => ({ data: null, error: errorNoConfig })),
    };
  }

  const results = await Promise.all(
    inputs.map(async (input) => {
      try {
        const data = await client.feedbackRecords.create(input);
        return { data, error: null as { status: number; message: string; detail: string } | null };
      } catch (err) {
        const status = err instanceof FormbricksHub.APIError ? err.status : 0;
        const message = err instanceof Error ? err.message : String(err);
        return { data: null, error: { status, message, detail: message } };
      }
    })
  );
  return { results };
}

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

          if (successes === 0) {
            await updateConnector(connector.id, environmentId, {
              status: "error",
              errorMessage: `Failed to send FeedbackRecords to Hub: ${results[0].error?.message || "Unknown error"}`,
            });
          } else {
            await updateConnector(connector.id, environmentId, {
              status: "active",
              errorMessage: `Partial failure: ${successes}/${feedbackRecords.length} records sent`,
              lastSyncAt: new Date(),
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

          await updateConnector(connector.id, environmentId, {
            status: "active",
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
        await updateConnector(connector.id, environmentId, {
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
};
