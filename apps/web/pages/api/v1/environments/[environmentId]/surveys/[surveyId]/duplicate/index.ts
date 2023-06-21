import { hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  const surveyId = req.query.surveyId?.toString();

  if (environmentId === undefined) {
    return res.status(400).json({ message: "Missing environmentId" });
  }
  if (surveyId === undefined) {
    return res.status(400).json({ message: "Missing surveyId" });
  }

  const hasAccess = await hasEnvironmentAccess(req, res, environmentId);
  if (!hasAccess) {
    return res.status(403).json({ message: "Not authorized" });
  }

  // POST
  else if (req.method === "POST") {
    // duplicate current survey including its triggers
    const existingSurvey = await prisma.survey.findFirst({
      where: {
        id: surveyId,
        environmentId,
      },
      include: {
        triggers: true,
        attributeFilters: true,
      },
    });

    if (!existingSurvey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    // create new survey with the data of the existing survey
    const newSurvey = await prisma.survey.create({
      data: {
        ...existingSurvey,
        id: undefined, // id is auto-generated
        environmentId: undefined, // environmentId is set below
        name: `${existingSurvey.name} (copy)`,
        status: "draft",
        questions: JSON.parse(JSON.stringify(existingSurvey.questions)),
        thankYouCard: JSON.parse(JSON.stringify(existingSurvey.thankYouCard)),
        triggers: {
          create: existingSurvey.triggers.map((trigger) => ({
            eventClassId: trigger.eventClassId,
          })),
        },
        attributeFilters: {
          create: existingSurvey.attributeFilters.map((attributeFilter) => ({
            attributeClassId: attributeFilter.attributeClassId,
            condition: attributeFilter.condition,
            value: attributeFilter.value,
          })),
        },
        environment: {
          connect: {
            id: environmentId,
          },
        },
      },
    });

    return res.json(newSurvey);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
