import { hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();
  const targetEnvironmentId = req.query.targetEnvironmentId?.toString();

  const surveyId = req.query.surveyId?.toString();

  if (environmentId === undefined) {
    return res.status(400).json({ message: "Missing environmentId" });
  }
  if (surveyId === undefined) {
    return res.status(400).json({ message: "Missing surveyId" });
  }

  const hasAccess = await hasEnvironmentAccess(req, res, environmentId);
  const hasTargetEnvAccess = await hasEnvironmentAccess(req, res, targetEnvironmentId);

  if (!hasAccess || !hasTargetEnvAccess) {
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
        triggers: {
          include: {
            eventClass: true,
          },
        },
      },
    });

    if (!existingSurvey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    let targetEnvironmentTriggers: string[] = [];
    // map the local triggers to the target environment
    for (let i = 0; i < existingSurvey.triggers.length; i++) {
      const trigger = existingSurvey.triggers[i];
      const targetEnvironmentTrigger = await prisma.eventClass.findFirst({
        where: {
          name: trigger.eventClass.name,
          environment: {
            id: targetEnvironmentId,
          },
        },
      });
      if (!targetEnvironmentTrigger) {
        // if the trigger does not exist in the target environment, create it
        const newTrigger = await prisma.eventClass.create({
          data: {
            name: trigger.eventClass.name,
            environment: {
              connect: {
                id: targetEnvironmentId,
              },
            },
            createdAt: new Date(),
            updatedAt: new Date(),
            description: trigger.eventClass.description,
            type: trigger.eventClass.type,
            noCodeConfig: trigger.eventClass.noCodeConfig
              ? JSON.parse(JSON.stringify(trigger.eventClass.noCodeConfig))
              : undefined,
          },
        });
        targetEnvironmentTriggers.push(newTrigger.id);
      } else {
        targetEnvironmentTriggers.push(targetEnvironmentTrigger.id);
      }
    }

    // create new survey with the data of the existing survey
    const newSurvey = await prisma.survey.create({
      data: {
        ...existingSurvey,
        id: undefined, // id is auto-generated
        environmentId: undefined, // environmentId is set below
        name: `${existingSurvey.name} (copy)`,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "draft",
        questions: JSON.parse(JSON.stringify(existingSurvey.questions)),
        thankYouCard: JSON.parse(JSON.stringify(existingSurvey.thankYouCard)),
        triggers: {
          create: targetEnvironmentTriggers.map((eventClassId) => ({
            eventClassId: eventClassId,
          })),
        },
        environment: {
          connect: {
            id: targetEnvironmentId,
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
