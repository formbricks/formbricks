import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const formId = req.query.formId.toString();

  // POST/capture/forms/[formId]/schema
  // Update form schema
  // Required fields in body: -
  // Optional fields in body: customerId, data
  if (req.method === "POST") {
    const schema = req.body;

    // create form in db
    await prisma.form.update({
      where: {
        id: formId,
      },
      data: {
        schema,
      },
    });
    res.status(201).end();
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
