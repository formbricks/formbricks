import { hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import { getAllUserSegments } from "@formbricks/lib/services/userSegment";
import { ZUserSegmentFilterGroup } from "@formbricks/types/v1/userSegment";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  if (!(await hasEnvironmentAccess(req, res, environmentId))) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // GET
  if (req.method === "GET") {
    const userSegments = await getAllUserSegments(environmentId);
    return res.json(userSegments);
  }

  // POST
  if (req.method === "POST") {
    const { title, surveyId, filters } = req.body;

    // parsing filters
    const parseResult = ZUserSegmentFilterGroup.safeParse(filters);

    if (!parseResult.success) {
      return res.status(400).json({ message: "Invalid filters" });
    }

    const existingSurvey = await prisma.survey.findFirst({
      where: {
        id: surveyId,
      },
    });

    if (!existingSurvey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    const userSegment = await prisma.userSegment.create({
      data: {
        title,
        environmentId,
        filters,
        surveys: {
          connect: {
            id: surveyId,
          },
        },
      },
    });

    return res.json(userSegment);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
