import { sendSubmissionEmail } from "./email";
import crypto from "crypto";

export const runPipelines = async (form, submission) => {
  // handle integrations
  const pipelines = await prisma.pipeline.findMany({
    where: {
      form: { id: form.id },
      enabled: true,
    },
  });
  console.log(form);
  for (const pipeline of pipelines) {
    if (pipeline.type === "WEBHOOK") {
      await handleWebhook(pipeline, submission);
    }
    if (pipeline.type === "EMAIL_NOTIFICATION") {
      await handleEmailNotification(pipeline, form, submission);
    }
  }
};

async function handleWebhook(pipeline, submission) {
  if (pipeline.config.hasOwnProperty("endpointUrl") && pipeline.config.hasOwnProperty("secret")) {
    if (pipeline.events.includes("SUBMISSION_CREATED")) {
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

  if (pipeline.events.includes("SUBMISSION_CREATED")) {
    await sendSubmissionEmail(email, form.label, pipeline.formId, submission);
  }
}
