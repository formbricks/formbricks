import { getSessionOrUser } from "@/lib/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const formId = parseInt(req.query.formId.toString());
  if (isNaN(formId)) {
    return res.status(400).json({ message: "Invalid formId" });
  }

  // POST/capture/forms/[formId]/submissions
  // Create a new form submission
  // Required fields in body: -
  // Optional fields in body: customerId, data
  else if (req.method === "POST") {
    const submission = req.body;

    const event: any = {
      data: {
        data: submission.data,
        form: { connect: { id: formId } },
      },
    };

    if (submission.customerId) {
      // get team
      const form = await prisma.form.findUnique({
        where: { id: formId },
        select: {
          teamId: true,
        },
      });
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
    const result = await prisma.submission.create(event);
    res.json(result);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
