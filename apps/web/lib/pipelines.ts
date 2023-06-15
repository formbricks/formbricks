import { INTERNAL_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";

export async function sendToPipeline(event, data) {
  return fetch(`${WEBAPP_URL}/api/pipeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      internalSecret: INTERNAL_SECRET,
      environmentId: data.environmentId,
      surveyId: data.surveyId,
      event,
      data,
    }),
  }).catch((error) => {
    console.error(`Error sending event to pipeline: ${error}`);
  });
}
