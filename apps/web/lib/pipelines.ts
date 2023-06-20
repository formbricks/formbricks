import { INTERNAL_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { TPipelineTrigger } from "@formbricks/types/v1/pipelines";

export async function sendToPipeline({
  event,
  surveyId,
  environmentId,
  data,
}: {
  event: TPipelineTrigger;
  surveyId: string;
  environmentId: string;
  data: any;
}) {
  return fetch(`${WEBAPP_URL}/api/pipeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      internalSecret: INTERNAL_SECRET,
      environmentId: environmentId,
      surveyId: surveyId,
      event,
      data,
    }),
  }).catch((error) => {
    console.error(`Error sending event to pipeline: ${error}`);
  });
}
