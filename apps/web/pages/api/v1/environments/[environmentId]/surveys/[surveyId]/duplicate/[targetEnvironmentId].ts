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
  if (targetEnvironmentId === undefined) {
    return res.status(400).json({ message: "Missing targetEnvironmentId" });
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
        attributeFilters: {
          include: {
            attributeClass: true,
          },
        },
      },
    });

    if (!existingSurvey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    let targetEnvironmentTriggers: string[] = [];
    // map the local triggers to the target environment
    for (const trigger of existingSurvey.triggers) {
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

    let targetEnvironmentAttributeFilters: string[] = [];
    // map the local attributeFilters to the target env
    for (const attributeFilter of existingSurvey.attributeFilters) {
      // check if attributeClass exists in target env.
      // if not, create it
      const targetEnvironmentAttributeClass = await prisma.attributeClass.findFirst({
        where: {
          name: attributeFilter.attributeClass.name,
          environment: {
            id: targetEnvironmentId,
          },
        },
      });
      if (!targetEnvironmentAttributeClass) {
        const newAttributeClass = await prisma.attributeClass.create({
          data: {
            name: attributeFilter.attributeClass.name,
            description: attributeFilter.attributeClass.description,
            type: attributeFilter.attributeClass.type,
            environment: {
              connect: {
                id: targetEnvironmentId,
              },
            },
          },
        });
        targetEnvironmentAttributeFilters.push(newAttributeClass.id);
      } else {
        targetEnvironmentAttributeFilters.push(targetEnvironmentAttributeClass.id);
      }
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
          create: targetEnvironmentTriggers.map((eventClassId) => ({
            eventClassId: eventClassId,
          })),
        },
        attributeFilters: {
          create: existingSurvey.attributeFilters.map((attributeFilter, idx) => ({
            attributeClassId: targetEnvironmentAttributeFilters[idx],
            condition: attributeFilter.condition,
            value: attributeFilter.value,
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
