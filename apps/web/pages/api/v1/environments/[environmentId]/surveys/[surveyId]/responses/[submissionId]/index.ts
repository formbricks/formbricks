import { hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database/src/client";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();
  const surveyId = req.query.surveyId?.toString();
  const responseId = req.query.submissionId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }
  if (!surveyId) {
    return res.status(400).json({ message: "Missing surveyId" });
  }
  if (!responseId) {
    return res.status(400).json({ message: "Missing responseId" });
  }

  const hasAccess = await hasEnvironmentAccess(req, res, environmentId);
  if (!hasAccess) {
    return res.status(403).json({ message: "Not authorized" });
  }

  // GET /api/environments[environmentId]/surveys/[surveyId]/responses/[responseId]
  // Get a specific response
  if (req.method === "GET") {
    const response = await prisma.response.findFirst({
      where: {
        id: responseId,
        surveyId: surveyId,
      },
    });

    return res.json(response);
  }

  // POST /api/environments[environmentId]/surveys/[surveyId]/responses/[responseId]
  // Replace a specific response
  else if (req.method === "POST") {
    const data = { ...req.body, updatedAt: new Date() };
    const prismaRes = await prisma.response.update({
      where: { id: responseId },
      data,
    });
    return res.json(prismaRes);
  }

  // Delete /api/environments[environmentId]/surveys/[surveyId]/responses/[responseId]
  // Deletes a single survey
  else if (req.method === "DELETE") {
    const responseId = req.query.submissionId?.toString();
    const response = await prisma.response.findUnique({
      where: { id: responseId },
      select: { displayId: true },
    });
    if (response?.displayId) {
      const prismaRes = await prisma.display.delete({ where: { id: response.displayId } });
      return res.json(prismaRes);
    } else {
      const prismaRes = await prisma.response.delete({ where: { id: responseId } });
      return res.json(prismaRes);
    }
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
