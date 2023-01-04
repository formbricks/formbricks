import { prisma } from "@formbricks/database";
import crypto from "crypto";
import { sendSubmissionEmail } from "./email";

export const runPipelines = async (form, submission) => {
  // handle integrations
  const pipelines = await prisma.pipeline.findMany({
    where: {
      form: { id: form.id },
      enabled: true,
    },
  });
  for (const pipeline of pipelines) {
    if (pipeline.type === "webhook") {
      await handleWebhook(pipeline, submission);
    }
    if (pipeline.type === "emailNotification") {
      await handleEmailNotification(pipeline, form, submission);
    }
  }
};

async function handleWebhook(pipeline, submission) {
  if (pipeline.config.hasOwnProperty("endpointUrl") && pipeline.config.hasOwnProperty("secret")) {
    if (pipeline.events.includes("submissionCreated")) {
      const webhookData = pipeline.config;
      const body = { time: Math.floor(Date.now() / 1000), submission };
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

async function handleEmailNotification(pipeline, form, submission) {
  if (!pipeline.config.hasOwnProperty("email")) return;

  const { email } = pipeline.config.valueOf() as { email: string };

  if (pipeline.events.includes("submissionCreated")) {
    await sendSubmissionEmail(email, form.id, form.label, form.schema, submission);
  }
}
