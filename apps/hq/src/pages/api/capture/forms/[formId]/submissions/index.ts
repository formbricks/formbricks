import { runPipelines } from "@/lib/pipelinesHandler";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";
import NextCors from "nextjs-cors";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  await NextCors(req, res, {
    // Options
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    origin: "*",
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  });

  const formId = req.query.formId.toString();

  // POST/capture/forms/[formId]/submissions
  // Create a new form submission
  // Required fields in body: -
  // Optional fields in body: customerId, data
  if (req.method === "POST") {
    const submission = req.body;

    // get form
    const form = await prisma.form.findUnique({
      where: { id: formId },
    });

    const event: any = {
      data: {
        data: submission.data,
        form: { connect: { id: formId } },
      },
    };

    if (submission.customerId) {
      // create or link customer
      event.data.customer = {
        connectOrCreate: {
          where: {
            id_teamId: {
              id: submission.customerId,
              teamId: form.teamId,
            },
          },
          create: {
            id: submission.customerId,
            team: { connect: { id: form.teamId } },
          },
        },
      };
    }

    // create form in db
    const submissionResult = await prisma.submission.create(event);
    await runPipelines(form, submission);
    res.json(submissionResult);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
