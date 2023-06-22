import { captureTelemetry } from "@/../../packages/lib/telemetry";
import { hasEnvironmentAccess, getSessionUser } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";
import { responses } from "@/lib/api/response";
import { Prisma } from "@prisma/client";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();
  const responseId = req.query.submissionId?.toString();
  const surveyId = req.query.surveyId?.toString();

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

  // Check whether user has access to the environment
  const hasAccess = await hasEnvironmentAccess(req, res, environmentId);

  if (!hasAccess) {
    return res.status(403).json({ message: "You are not authorized to access this environment! " });
  }

  const currentResponse = await prisma.response.findUnique({
    where: {
      id: responseId,
    },
    select: {
      data: true,
      survey: {
        select: {
          environmentId: true,
        },
      },
    },
  });

  if (!currentResponse) {
    return responses.notFoundResponse("Response", responseId, true);
  }

  // GET /api/environments[environmentId]/survey[surveyId]/responses/[submissionId]/tags

  // Get all tags for a response

  if (req.method === "GET") {
    let tags;

    try {
      tags = await prisma.tagsOnResponses.findMany({
        where: {
          responseId,
        },
        include: {
          response: true,
          tag: true,
        },
      });
    } catch (e) {
      return res.status(500).json({ message: "Internal Server Error" });
    }

    captureTelemetry(`tags retrieved for response ${responseId}`);
    return res.json(tags);
  }

  // POST /api/environments[environmentId]/survey[surveyId]/responses/[submissionId]/tags

  // Create a tag for a response

  if (req.method === "POST") {
    const tagId = req.body.tagId;

    if (!tagId) {
      return res.status(400).json({ message: "Invalid tag Id" });
    }

    try {
      await prisma.tagsOnResponses.create({
        data: {
          responseId,
          tagId,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2002") {
          return res.status(400).json({ message: "Tag already exists" });
        }
      }

      return res.status(500).json({ message: "Internal Server Error" });
    }

    return res.json({
      success: true,
      message: `Tag ${tagId} created for response ${responseId}`,
    });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
