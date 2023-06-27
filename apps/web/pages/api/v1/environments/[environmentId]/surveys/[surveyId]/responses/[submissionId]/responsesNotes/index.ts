import { captureTelemetry } from "@/../../packages/lib/telemetry";
import { hasEnvironmentAccess, getSessionUser } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";
import { responses } from "@/lib/api/response";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();
  const responseId = req.query.submissionId?.toString();
  const surveyId = req.query.surveyId?.toString();

  // Check Authentication
  const currentUser: any = await getSessionUser(req, res);
  if (!currentUser) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // Check environmentId
  if (environmentId === undefined) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  // Check responseId
  if (responseId === undefined) {
    return res.status(400).json({ message: "Missing responseId" });
  }

  // Check surveyId
  if (surveyId === undefined) {
    return res.status(400).json({ message: "Missing surveyId" });
  }

  // Check whether user has access to the environment
  const hasAccess = await hasEnvironmentAccess(req, res, environmentId);
  if (!hasAccess) {
    return res.status(403).json({ message: "Not authorized" });
  }

  // GET /api/environments[environmentId]/survey[surveyId]/responses/[responseId]/responsesNote
  // Create a note to a response
  if (req.method === "POST") {
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
    const responseNote = {
      data: {
        createdAt: new Date(),
        updatedAt: new Date(),
        response: {
          connect: {
            id: responseId,
          },
        },
        user: {
          connect: {
            id: currentUser.id,
          },
        },
        text: req.body,
      },
    };

    const newResponseNote = await prisma.responseNote.create(responseNote);
    captureTelemetry("responseNote created");
    return res.json(newResponseNote);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
