import { handleWebhook } from "../components/pipelines/webhook";
import { sendFormSubmissionEmail, sendPageSubmissionEmail } from "./email";
import { capturePosthogEvent } from "./posthog";
import { prisma } from "@formbricks/database";
import { sendTelemetry } from "./telemetry";
import { ApiEvent, Schema } from "./types";

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
      !["createSubmissionSession", "pageSubmission", "formCompleted", "updateSchema"].includes(event.type)
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
  const form = await prisma.form.findUnique({
    where: {
      id: formId,
    },
    select: {
      owner: true,
      schema: true,
      id: true,
      createdAt: true,
      updatedAt: true,
      noCodeForm: true,
      name: true,
      formType: true,
    },
  });

  // save submission
  if (event.type === "pageSubmission") {
    const schema = form.schema as Schema;
    const { pageName } = event.data;
    const pages = schema.pages.filter((page) => page.type === "form");

    const indexOfPage = pages.findIndex((page) => page.name === pageName);
    // const owner = form.owner;

    await prisma.sessionEvent.create({
      data: {
        type: "pageSubmission",
        data: {
          pageName: event.data.pageName,
          submission: event.data.submission,
        },
        submissionSession: { connect: { id: event.data.submissionSessionId } },
      },
    });

    capturePosthogEvent(form.owner.id, "pageSubmission received", {
      formId,
      formType: form.formType,
    });

    sendTelemetry("pageSubmission received");

    if (indexOfPage === pages.length - 1) {
      processApiEvent(
        {
          ...event,
          type: "formCompleted",
          data: {
            submissionSessionId: event.data.submissionSessionId,
          },
        },
        formId
      );
    }
  } else if (event.type === "formCompleted") {
    await prisma.sessionEvent.create({
      data: {
        type: "formCompleted",
        data: {},
        submissionSession: { connect: { id: event.data.submissionSessionId } },
      },
    });

    capturePosthogEvent(form.owner.id, "pageSubmission received", {
      formId,
      formType: form.formType,
    });

    sendTelemetry("formCompleted received");
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
    if (pipeline.type === "EMAIL_NOTIFICATION") {
      if (!pipeline.data.hasOwnProperty("email")) return;

      const { email } = pipeline.data.valueOf() as { email: string };

      if (event.type === "pageSubmission" && pipeline.events.includes("PAGE_SUBMISSION")) {
        await sendPageSubmissionEmail(email, form.name, pipeline.formId);
      } else if (event.type === "formCompleted" && pipeline.events.includes("FORM_COMPLETED")) {
        await sendFormSubmissionEmail(email, form.name, pipeline.formId);
      }
    }
  }
};
