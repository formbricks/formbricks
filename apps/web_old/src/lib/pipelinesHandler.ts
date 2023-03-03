import { prisma } from "@formbricks/database";
import crypto from "crypto";
import { sendSubmissionEmail } from "./email";
import { MergeWithSchema } from "./submissions";

export const runPipelines = async (triggeredEvents, form, submissionReceived, submissionFull) => {
  // handle integrations
  const pipelines = await prisma.pipeline.findMany({
    where: {
      form: { id: form.id },
      enabled: true,
    },
  });
  for (const pipeline of pipelines) {
    if (pipeline.type === "emailNotification") {
      await handleEmailNotification(triggeredEvents, pipeline, form, submissionReceived, submissionFull);
    }
    if (pipeline.type === "slackNotification") {
      await handleSlackNotification(triggeredEvents, pipeline, form, submissionReceived, submissionFull);
    }
    if (pipeline.type === "webhook") {
      await handleWebhook(triggeredEvents, pipeline, submissionReceived, submissionFull);
    }
  }
};

async function handleWebhook(triggeredEvents, pipeline, submissionReceived, submissionFull) {
  if (pipeline.config.hasOwnProperty("endpointUrl") && pipeline.config.hasOwnProperty("secret")) {
    let body;
    if (triggeredEvents.includes("submissionCreated") && pipeline.events.includes("submissionCreated")) {
      body = { time: Math.floor(Date.now() / 1000), submissionFull };
      await sendWebhook(pipeline, body);
    }
    if (triggeredEvents.includes("submissionUpdated") && pipeline.events.includes("submissionUpdated")) {
      body = { time: Math.floor(Date.now() / 1000), submissionReceived };
      await sendWebhook(pipeline, body);
    }
    if (triggeredEvents.includes("submissionUpdated") && pipeline.events.includes("submissionUpdated")) {
      body = { time: Math.floor(Date.now() / 1000), submissionFull };
      await sendWebhook(pipeline, body);
    }
  }
}

const sendWebhook = async (pipeline, body) => {
  const webhookData = pipeline.config;
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
};

async function handleEmailNotification(triggeredEvents, pipeline, form, submissionReceived, submissionFull) {
  if (!pipeline.config.hasOwnProperty("email")) return;

  const { email } = pipeline.config.valueOf() as { email: string };

  if (triggeredEvents.includes("submissionCreated") && pipeline.events.includes("submissionCreated")) {
    await sendSubmissionEmail(
      email,
      "created",
      form.organisationId,
      form.id,
      form.label,
      form.schema,
      submissionFull
    );
  }
  if (triggeredEvents.includes("submissionUpdated") && pipeline.events.includes("submissionUpdated")) {
    await sendSubmissionEmail(
      email,
      "updated",
      form.organisationId,
      form.id,
      form.label,
      form.schema,
      submissionReceived
    );
  }
  if (triggeredEvents.includes("submissionFinished") && pipeline.events.includes("submissionFinished")) {
    await sendSubmissionEmail(
      email,
      "finished",
      form.organisationId,
      form.id,
      form.label,
      form.schema,
      submissionFull
    );
  }
}

async function handleSlackNotification(triggeredEvents, pipeline, form, submissionReceived, submissionFull) {
  if (pipeline.config.hasOwnProperty("endpointUrl")) {
    let body;
    if (triggeredEvents.includes("submissionCreated") && pipeline.events.includes("submissionCreated")) {
      body = {
        text: `Someone just filled out your form "${form.label}" in Formbricks.`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Someone just filled out your form "${form.label}". <${process.env.NEXTAUTH_URL}/organisations/${form.organisationId}/forms/${form.id}/feedback|View in Formbricks>`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${Object.entries(MergeWithSchema(submissionFull.data, form.schema))
                .map(([key, value]) => `*${key}*\n${value}\n`)
                .join("")}`,
            },
          },
        ],
      };
      await sendSlackMessage(pipeline, body);
    }
    if (triggeredEvents.includes("submissionUpdated") && pipeline.events.includes("submissionUpdated")) {
      body = {
        text: `Someone just updated a submission in your form "${form.label}" in Formbricks.`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Someone just updated a submission in your form "${form.label}". <${process.env.NEXTAUTH_URL}/organisations/${form.organisationId}/forms/${form.id}/feedback|View in Formbricks>`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${Object.entries(MergeWithSchema(submissionReceived.data, form.schema))
                .map(([key, value]) => `*${key}*\n${value}\n`)
                .join("")}`,
            },
          },
        ],
      };
      await sendSlackMessage(pipeline, body);
    }
    if (triggeredEvents.includes("submissionFinished") && pipeline.events.includes("submissionFinished")) {
      body = {
        text: `Someone just finished your form "${form.label}" in Formbricks.`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Someone just finished your form "${form.label}". <${process.env.NEXTAUTH_URL}/organisations/${form.organisationId}/forms/${form.id}/feedback|View in Formbricks>`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${Object.entries(MergeWithSchema(submissionFull.data, form.schema))
                .map(([key, value]) => `*${key}*\n${value}\n`)
                .join("")}`,
            },
          },
        ],
      };
      await sendSlackMessage(pipeline, body);
    }
  }
}

const sendSlackMessage = async (pipeline, body) => {
  fetch(pipeline.config.endpointUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
};
