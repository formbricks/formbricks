import { hasEnvironmentAccess } from "@/app/lib/api/apiHelper";
import type { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "@formbricks/database";
import { getUserSegment } from "@formbricks/lib/services/userSegment";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();
  const userSegmentId = req.query.userSegmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  if (!userSegmentId) {
    return res.status(400).json({ message: "Missing userSegmentId" });
  }

  if (!(await hasEnvironmentAccess(req, res, environmentId))) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // GET
  if (req.method === "GET") {
    const userSegment = await getUserSegment(userSegmentId);

    if (!userSegment) {
      return res.status(404).json({ message: "User segment not found" });
    }

    const activeSurveysData = await prisma.userSegment.findUnique({
      where: {
        id: userSegmentId,
        surveys: {
          every: {
            status: "inProgress",
          },
        },
      },
      select: {
        surveys: {
          select: { name: true },
        },
      },
    });

    const inactiveSurveysData = await prisma.userSegment.findUnique({
      where: {
        id: userSegmentId,
        surveys: {
          every: {
            status: {
              in: ["paused", "completed"],
            },
          },
        },
      },
      select: {
        surveys: {
          select: { name: true },
        },
      },
    });

    const activeSurveys = activeSurveysData?.surveys.map((survey) => survey.name);
    const inactiveSurveys = inactiveSurveysData?.surveys.map((survey) => survey.name);

    return res.json({
      ...userSegment,
      activeSurveys,
      inactiveSurveys,
    });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
