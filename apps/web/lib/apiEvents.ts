import { handleWebhook } from "../components/pipelines/webhook";
import { capturePosthogEvent } from "./posthog";
import { prisma } from "database";
import { sendTelemetry } from "./telemetry";
import { ApiEvent } from "./types";

type validationError = {
  status: number;
  message: string;
};

export const validateEvents = (events: ApiEvent[]): validationError | undefined => {
  if (!Array.isArray(events)) {
    return { status: 400, message: `"events" needs to be a list` };
  }
  for (const event of events) {
    if (
      !["createSubmissionSession", "pageSubmission", "submissionCompleted", "updateSchema"].includes(
        event.type
      )
    ) {
      return {
        status: 400,
        message: `event type ${event.type} is not suppported`,
      };
    }
    return;
  }
};

export const processApiEvent = async (event: ApiEvent, formId) => {
  // save submission
  if (event.type === "pageSubmission") {
    const data = event.data;
    await prisma.sessionEvent.create({
      data: {
        type: "pageSubmission",
        data: {
          pageName: data.pageName,
          submission: data.submission,
        },
        submissionSession: { connect: { id: data.submissionSessionId } },
      },
    });
    const form = await prisma.form.findUnique({
      where: {
        id: formId,
      },
    });
    capturePosthogEvent(form.ownerId, "pageSubmission received", {
      formId,
      formType: form.formType,
    });
    sendTelemetry("pageSubmission received");
  } else if (event.type === "submissionCompleted") {
    // TODO
  } else if (event.type === "updateSchema") {
    const data = { schema: event.data, updatedAt: new Date() };
    await prisma.form.update({
      where: { id: formId },
      data,
    });
  } else {
    throw Error(`apiEvents: unsupported event type in event ${JSON.stringify(event)}`);
  }
  // handle integrations
  const pipelines = await prisma.pipeline.findMany({
    where: {
      form: { id: formId },
      enabled: true,
    },
    orderBy: [
      {
        createdAt: "desc",
      },
    ],
  });
  for (const pipeline of pipelines) {
    if (pipeline.type === "WEBHOOK") {
      handleWebhook(pipeline, event);
    }
  }
};
