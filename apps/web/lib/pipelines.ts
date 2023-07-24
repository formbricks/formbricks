import { INTERNAL_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { TPipelineInput } from "@formbricks/types/v1/pipelines";

export async function sendToPipeline({ event, surveyId, environmentId, response }: TPipelineInput) {
  return fetch(`${WEBAPP_URL}/api/pipeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": INTERNAL_SECRET,
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
}
