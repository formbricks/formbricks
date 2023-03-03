import { getSessionOrUser } from "@/lib/apiHelper";
import { capturePosthogEvent } from "@/lib/posthog";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const organisationId = req.query.organisationId.toString();

  const formId = req.query.formId.toString();

  // check organisation permission
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organisationId: {
        userId: user.id,
        organisationId,
      },
    },
  });
  if (membership === null) {
    return res
      .status(403)
      .json({ message: "You don't have access to this organisation or this organisation doesn't exist" });
  }

  // GET /api/organisations[organisationId]/forms/[formId]
  // Get a specific organisation
  if (req.method === "GET") {
    const forms = await prisma.form.findFirst({
      where: {
        id: formId,
        organisationId,
      },
    });

    return res.json(forms);
  }

  // POST /api/organisations[organisationId]/forms/[formId]
  // Replace a specific form
  else if (req.method === "POST") {
    const data = { ...req.body, updatedAt: new Date() };
    const prismaRes = await prisma.form.update({
      where: { id: formId },
      data,
    });
    return res.json(prismaRes);
  }

  // Delete /api/organisations[organisationId]/forms/[formId]
  // Deletes a single form
  else if (req.method === "DELETE") {
    const prismaRes = await prisma.form.delete({
      where: { id: formId },
    });
    capturePosthogEvent(user.id, "form deleted", {
      formId,
    });
    return res.json(prismaRes);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
