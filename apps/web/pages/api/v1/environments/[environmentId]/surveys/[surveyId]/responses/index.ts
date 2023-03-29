import { getSessionOrUser, hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const environmentId = req.query.environmentId?.toString();
  const surveyId = req.query.surveyId?.toString();

  if (environmentId === undefined) {
    return res.status(400).json({ message: "Missing environmentId" });
  }
  if (surveyId === undefined) {
    return res.status(400).json({ message: "Missing surveyId" });
  }

  const hasAccess = await hasEnvironmentAccess(user, environmentId);
  if (hasAccess === false) {
    return res.status(403).json({ message: "Not authorized" });
  }

  // GET
  if (req.method === "GET") {
    // get responses
    const responses = await prisma.response.findMany({
      where: {
        survey: {
          id: surveyId,
        },
      },
      orderBy: [
        {
          createdAt: "desc",
        },
      ],
    });
    return res.json(responses);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
