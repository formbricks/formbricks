import { getSessionOrUser, hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const environmentId = req.query.environmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  const hasAccess = await hasEnvironmentAccess(user, environmentId);
  if (hasAccess === false) {
    return res.status(403).json({ message: "Not authorized" });
  }

  // GET /api/environments[environmentId]/surveys
  // Get a specific environment
  if (req.method === "GET") {
    const surveys = await prisma.survey.findMany({
      where: {
        environment: {
          id: environmentId,
        },
      },
      include: {
        _count: {
          select: { responses: true },
        },
      },
    });

    return res.json(surveys);
  }

  // POST /api/environments[environmentId]/surveys
  // Create a new survey
  // Required fields in body: -
  // Optional fields in body: label, schema
  else if (req.method === "POST") {
    const survey = req.body;

    // create survey in db
    const result = await prisma.survey.create({
      data: {
        ...survey,
        environment: { connect: { id: environmentId } },
      },
    });

    captureTelemetry("survey created");

    res.json(result);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
