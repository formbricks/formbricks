import { CRON_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { TPipelineInput } from "@formbricks/types/pipelines";

export const sendToPipeline = async ({ event, surveyId, environmentId, response }: TPipelineInput) => {
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
    console.error(`Error sending event to pipeline: ${error}`);
  });
};
