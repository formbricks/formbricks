import { getSessionUser, hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@formbricks/database";
import { responses } from "@/lib/api/response";
import { captureTelemetry } from "@formbricks/lib/telemetry";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();
  const responseId = req.query.submissionId?.toString();
  const surveyId = req.query.surveyId?.toString();
  const noteId = req.query.noteId?.toString();

  // Check Authentication
  const currentUser: any = await getSessionUser(req, res);
  if (!currentUser) {
    return res.status(401).json({ message: "Not Authenticated" });
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

  // Check noteId
  if (noteId === undefined) {
    return res.status(400).json({ message: "Missing noteId" });
  }

  // Check whether user has access to the environment
  const hasAccess = await hasEnvironmentAccess(req, res, environmentId);
  if (!hasAccess) {
    return res.status(403).json({ message: "Not authorized" });
  }

  if (req.method === "PUT") {
    const currentResponse = await prisma.response.findUnique({
      where: {
        id: responseId,
      },
      select: {
        notes: true,
      },
    });

    if (!currentResponse) {
      return responses.notFoundResponse("Response", responseId, true);
    }

    const currentNote = currentResponse.notes.find((note) => note.id === noteId);

    if (!currentNote) {
      return responses.notFoundResponse("Note", noteId, true);
    }

    const updatedResponse = await prisma.response.update({
      where: {
        id: responseId,
      },
      data: {
        notes: {
          updateMany: {
            where: {
              id: noteId,
            },
            data: {
              text: req.body,
              updatedAt: new Date(),
            },
          },
        },
      },
    });
    captureTelemetry("responseNote Updated");
    return res.json(updatedResponse);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
