import type { NextApiResponse, NextApiRequest } from "next";
import { getSession } from "next-auth/react";
import { formHasOwnership } from "../../../../lib/api";
import { prisma } from "database";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const session = await getSession({ req: req });
  if (!session) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const formId = req.query.id.toString();

  const ownership = await formHasOwnership(session, formId);
  if (!ownership) {
    return res.status(401).json({ message: "You are not authorized to access this form" });
  }

  // GET /api/forms/:id
  // Get form with specific id
  if (req.method === "GET") {
    const formData = await prisma.form.findUnique({
      where: {
        id: formId,
      },
    });
    if (formData === null) return res.status(404).json({ error: "not found" });
    return res.json(formData);
  }
  // POST /api/forms/:id
  // Updates an existing form
  // Required fields in body: -
  // Optional fields in body: title, published, finishedOnboarding, elements, elementsDraft
  else if (req.method === "POST") {
    const data = { ...req.body, updatedAt: new Date() };
    const prismaRes = await prisma.form.update({
      where: { id: formId },
      data,
    });
    return res.json(prismaRes);
  } else if (req.method === "DELETE") {
    const prismaRes = await prisma.form.delete({
      where: { id: formId },
    });
    return res.json(prismaRes);
  }
  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
