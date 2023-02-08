import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const formId = req.query.formId.toString();

  // CORS
  if (req.method === "OPTIONS") {
    res.status(200).end();
  }

  // POST/capture/forms/[formId]/schema
  // Update form schema
  // Required fields in body: -
  // Optional fields in body: customerId, data
  else if (req.method === "POST") {
    const schema = req.body;

    // find form
    const form = await prisma.form.findUnique({
      where: {
        id: formId,
      },
    });

    if (!form) {
      return res.status(404).json({ error: `Form with id "${formId}" not found` });
    }

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
