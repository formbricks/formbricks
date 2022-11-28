import { getSessionOrUser } from "@/lib/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const teamId = parseInt(req.query.teamId.toString());
  if (isNaN(teamId)) {
    return res.status(400).json({ message: "Invalid teamId" });
  }

  const formId = parseInt(req.query.formId.toString());
  if (isNaN(formId)) {
    return res.status(400).json({ message: "Invalid formId" });
  }

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

  // GET /api/teams[teamId]/forms/[formId]/submissions
  // Get submissions
  if (req.method === "GET") {
    // get submission
    const submissions = await prisma.submission.findMany({
      where: {
        form: {
          id: formId,
        },
      },
    });

    return res.json(submissions);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
