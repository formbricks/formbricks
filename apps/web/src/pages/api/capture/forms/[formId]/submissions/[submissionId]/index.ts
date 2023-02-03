import { runPipelines } from "@/lib/pipelinesHandler";
import { capturePosthogEvent } from "@/lib/posthog";
import { captureTelemetry } from "@/lib/telemetry";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const formId = req.query.formId.toString();
  const submissionId = req.query.submissionId.toString();

  // CORS
  if (req.method === "OPTIONS") {
    res.status(200).end();
  }

  // PUT /capture/forms/[formId]/submissions/[submissionId]
  // Extend an existing form submission
  // Required fields in body: -
  // Optional fields in body: customerId, data
  else if (req.method === "PUT") {
    const submission = req.body;

    // get form
    const form = await prisma.form.findUnique({
      where: { id: formId },
    });

    const prevSubmission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });

    if (prevSubmission === null) {
      return res.status(404).json({ message: "Submission not found" });
    }

    if (typeof prevSubmission.data !== "object") {
      prevSubmission.data = {};
    }

    const event: any = {
      where: { id: submissionId },
      data: {
        meta: { userAgent: req.headers["user-agent"] },
      },
    };

    if (submission.finished) {
      event.data.finished = submission.finished;
    }

    if (submission.data) {
      event.data.data = { ...prevSubmission.data, ...submission.data };
    }

    if (submission.customer && "email" in submission.customer) {
      const customerEmail = submission.customer.email;
      const customerData = { ...submission.customer };
      delete customerData.email;
      // create or link customer
      event.data.customer = {
        connectOrCreate: {
          where: {
            email_organisationId: {
              email: submission.customer.email,
              organisationId: form.organisationId,
            },
          },
          create: {
            email: customerEmail,
            organisation: { connect: { id: form.organisationId } },
            data: customerData,
          },
        },
      };
    }

    // create form in db
    const submissionResult = await prisma.submission.update(event);
    const pipelineEvents = [];
    if (submission.data) {
      pipelineEvents.push("submissionUpdated");
    }
    if (submission.finished) {
      pipelineEvents.push("submissionFinished");
    }
    await runPipelines(pipelineEvents, form, submission, submissionResult);
    // tracking
    if (submission.finished) {
      capturePosthogEvent(form.organisationId, "submission finished", {
        formId,
      });
      captureTelemetry("submission finished");
    } else {
      capturePosthogEvent(form.organisationId, "submission updated", {
        formId,
      });
      captureTelemetry("submission updated");
    }
    res.json(submissionResult);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
