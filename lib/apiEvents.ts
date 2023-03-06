import { handleAirtable } from "../components/pipelines/airtable";
import { handleWebhook } from "../components/pipelines/webhook";
import { capturePosthogEvent } from "./posthog";
import { prisma } from "./prisma";
import { sendTelemetry } from "./telemetry";
import { ApiEvent, SchemaPage } from "./types";

type validationError = {
  status: number;
  message: string;
};

export const validateEvents = (
  events: ApiEvent[]
): validationError | undefined => {
  if (!Array.isArray(events)) {
    return { status: 400, message: `"events" needs to be a list` };
  }
  for (const event of events) {
    if (
      ![
        "createSubmissionSession",
        "pageSubmission",
        "submissionCompleted",
        "formOpened",
        "updateSchema",
      ].includes(event.type)
    ) {
      return {
        status: 400,
        message: `event type ${event.type} is not suppported`,
      };
    }
    return;
  }
};

export const processApiEvent = async (event: ApiEvent, formId, candidateId) => {
  let userOpenFormSession = null;
  // save submission
  if (event.type === "pageSubmission") {
    const pageSubmited = event.data;

    const sessionEvent = await prisma.sessionEvent.findFirst({
      where: {
        AND: [
          { data: { path: ["formId"], equals: formId } },
          { data: { path: ["candidateId"], equals: candidateId } },
          { data: { path: ["pageName"], equals: event.data.pageName } },
        ],
      },
    });

    if (sessionEvent) {
      sessionEvent.data = pageSubmited;
      await prisma.sessionEvent.update({
        where: {
          id: sessionEvent.id,
        },
        data: {
          data: { ...sessionEvent.data, formId, candidateId },
        },
      });
    } else {
      await prisma.sessionEvent.create({
        data: {
          type: "pageSubmission",
          data: {
            formId,
            candidateId,
            ...pageSubmited,
          },
          submissionSession: {
            connect: { id: pageSubmited.submissionSessionId },
          },
        },
      });
    }

    const form = await prisma.form.findUnique({
      where: {
        id: formId,
      },
    });
    capturePosthogEvent(form.ownerId, "pageSubmission received", { formId });
    sendTelemetry("pageSubmission received");
  } else if (event.type === "submissionCompleted") {
    // TODO
  } else if (event.type === "updateSchema") {
    //const data = { schema: event.data, updatedAt: new Date() };

    const form = await prisma.form.findUnique({ where: { id: formId } });
    // TODO find way to fix this code
    // const schema = form.schema as Schema;

    // const data = {
    //   schema: [...event.data.pages, ...schema.pages],
    //   updatedAt: new Date(),
    // };

    const schema = form.schema as SchemaPage[];

    const data = {
      schema: [...event.data.pages, ...schema],
      updatedAt: new Date(),
    };

    await prisma.form.update({
      where: { id: formId },
      data,
    });
  } else if (event.type === "formOpened") {
    // check if usr  opened form

    userOpenFormSession = await prisma.sessionEvent.findFirst({
      where: {
        type: "formOpened",
        AND: [
          {
            data: {
              path: ["formId"],
              equals: formId,
            },
          },
          {
            data: {
              path: ["candidateId"],
              equals: candidateId,
            },
          },
        ],
      },
    });

    if (userOpenFormSession === null) {
      const { id } = await prisma.submissionSession.create({
        data: { form: { connect: { id: formId } } },
      });

      await prisma.sessionEvent.create({
        data: {
          type: "formOpened",
          data: {
            formId,
            candidateId,
            roll: event.data.roll,
          },
          submissionSession: { connect: { id } },
        },
      });
    }
  } else {
    throw Error(
      `apiEvents: unsupported event type in event ${JSON.stringify(event)}`
    );
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
    } else if (pipeline.type === "AIRTABLE") {
      if (event.type !== "formOpened") {
        handleAirtable(pipeline, event);
      } else if (event.type === "formOpened" && userOpenFormSession === null) {
        handleAirtable(pipeline, event);
      }
    }
  }
};
//
