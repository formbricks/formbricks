import crypto from "crypto";
import { ApiEvent } from "../../../lib/types";

export async function handleWebhook(pipeline, event: ApiEvent) {
  if (pipeline.data.hasOwnProperty("endpointUrl") && pipeline.data.hasOwnProperty("secret")) {
    if (event.type === "pageSubmission" && pipeline.events.includes("PAGE_SUBMISSION")) {
      const webhookData = pipeline.data;
      const body = { time: Math.floor(Date.now() / 1000), event };
      fetch(webhookData.endpointUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": `sha256=${crypto
            .createHmac("sha256", webhookData.secret.toString())
            .update(JSON.stringify(body))
            .digest("base64")}`,
        },
        body: JSON.stringify(body),
      });
    }
  }
}
