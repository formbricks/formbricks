import { getSessionOrUser } from "@/lib/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const teamId = req.query.teamId.toString();

  const formId = req.query.formId.toString();

  // check team permission
  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId: user.id,
        teamId,
      },
    },
  });
  if (membership === null) {
    return res.status(403).json({ message: "You don't have access to this team or this team doesn't exist" });
  }

  // GET /api/teams[teamId]/forms/[formId]
  // Get a specific team
  if (req.method === "GET") {
    const forms = await prisma.form.findFirst({
      where: {
        id: formId,
        teamId,
      },
    });

    return res.json(forms);
  }

  // POST /api/teams[teamId]/forms/[formId]
  // Replace a specific form
  else if (req.method === "POST") {
    const data = { ...req.body, updatedAt: new Date() };
    const prismaRes = await prisma.form.update({
      where: { id: formId },
      data,
    });
    return res.json(prismaRes);
  }

  // Delete /api/teams[teamId]/forms/[formId]
  // Deletes a single form
  else if (req.method === "DELETE") {
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
