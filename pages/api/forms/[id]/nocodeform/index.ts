import type { NextApiResponse, NextApiRequest } from "next";
import { getSession } from "next-auth/react";
import { formHasOwnership } from "../../../../../lib/api";
import { prisma } from "../../../../../lib/prisma";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check Authentication
  const session = await getSession({ req: req });
  if (!session) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const formId = req.query.id.toString();

  // GET /api/forms/:id/nocodeform
  // Get noCodeForm for a form with specific id
  if (req.method === "GET") {
    const data = await prisma.noCodeForm.findUnique({
      where: {
        formId: formId,
      },
    });
    return res.json(data);
  }
  // POST /api/forms/:id/nocodeform
  // Updates an existing nocodeform
  // Required fields in body: -
  // Optional fields in body: title, published, finishedOnboarding, elements, elementsDraft
  else if (req.method === "POST") {
    const ownership = await formHasOwnership(session, formId);
    if (!ownership) {
      return res
        .status(401)
        .json({ message: "You are not authorized to change this noCodeForm" });
    }
    const data = { ...req.body, updatedAt: new Date() };
    // create or update record
    const prismaRes = await prisma.noCodeForm.upsert({
      where: { formId },
      update: data,
      create: { form: { connect: { id: formId } } },
    });
    return res.json(prismaRes);
  }
  // Unknown HTTP Method
  else {
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}
