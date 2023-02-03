import { getSessionOrUser } from "@/lib/apiHelper";
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

  // GET /api/organisations[organisationId]/forms/[formId]/submissions
  // Get submissions
  if (req.method === "GET") {
    // get submission
    const submissions = await prisma.submission.findMany({
      where: {
        form: {
          id: formId,
        },
      },
      orderBy: [
        {
          createdAt: "desc",
        },
      ],
    });
    return res.json(submissions);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
