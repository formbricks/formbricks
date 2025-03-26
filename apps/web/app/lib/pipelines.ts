import { TPipelineInput } from "@/app/lib/types/pipelines";
import { CRON_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { logger } from "@formbricks/logger";

export const sendToPipeline = async ({ event, surveyId, environmentId, response }: TPipelineInput) => {
  if (!CRON_SECRET) {
    throw new Error("CRON_SECRET is not set");
  }

  return fetch(`${WEBAPP_URL}/api/pipeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CRON_SECRET,
    },
    body: JSON.stringify({
      environmentId: environmentId,
      surveyId: surveyId,
      event,
      response,
    }),
  }).catch((error) => {
    logger.error(error, "Error sending event to pipeline");
  });
};
