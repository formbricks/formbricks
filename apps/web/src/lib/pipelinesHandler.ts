import { prisma } from "@formbricks/database";
import crypto from "crypto";
import { sendSubmissionEmail } from "./email";
import { MergeWithSchema } from "./submissions";

export const runPipelines = async (form, submission) => {
  // handle integrations
  const pipelines = await prisma.pipeline.findMany({
    where: {
      form: { id: form.id },
      enabled: true,
    },
  });
  for (const pipeline of pipelines) {
    if (pipeline.type === "emailNotification") {
      await handleEmailNotification(pipeline, form, submission);
    }
    if (pipeline.type === "slackNotification") {
      await handleSlackNotification(pipeline, form, submission);
    }
    if (pipeline.type === "webhook") {
      await handleWebhook(pipeline, submission);
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
    await sendSubmissionEmail(email, form.workspaceId, form.id, form.label, form.schema, submission);
  }
}

async function handleSlackNotification(pipeline, form, submission) {
  if (pipeline.config.hasOwnProperty("endpointUrl")) {
    if (pipeline.events.includes("submissionCreated")) {
      const body = {
        text: `Someone just filled out your form "${form.label}" in Formbricks.`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Someone just filled out your form "${form.label}". <${process.env.NEXTAUTH_URL}/workspaces/${form.workspaceId}/forms/${form.id}/feedback|View in Formbricks>`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${Object.entries(MergeWithSchema(submission.data, form.schema))
                .map(([key, value]) => `*${key}*\n${value}\n`)
                .join("")}`,
            },
          },
        ],
      };
      fetch(pipeline.config.endpointUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    }
  }
}
