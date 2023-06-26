import { hasEnvironmentAccess, getSessionUser } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database/src/client";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();
  const responseId = req.query.submissionId?.toString();
  const surveyId = req.query.surveyId?.toString();
  const tagId = req.query.tagId?.toString();

  // Check Authentication
  const currentUser = await getSessionUser(req, res);
  if (!currentUser) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // Check environmentId
  if (!environmentId) {
    return res.status(400).json({ message: "Invalid environmentId" });
  }

  // Check responseId
  if (!responseId) {
    return res.status(400).json({ message: "Invalid responseId" });
  }

  // Check surveyId
  if (!surveyId) {
    return res.status(400).json({ message: "Invalid surveyId" });
  }

  // Check tagId
  if (!tagId) {
    return res.status(400).json({ message: "Invalid tagId" });
  }

  // Check whether user has access to the environment
  const hasAccess = await hasEnvironmentAccess(req, res, environmentId);

  if (!hasAccess) {
    return res.status(403).json({ message: "You are not authorized to access this environment! " });
  }

  if (req.method === "DELETE") {
    let deletedTag;

    try {
      deletedTag = await prisma.tagsOnResponses.delete({
        where: {
          responseId_tagId: {
            responseId,
            tagId,
          },
        },
      });
    } catch (e) {
      return res.status(500).json({ message: "Internal Server Error" });
    }

    return res.json(deletedTag);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
