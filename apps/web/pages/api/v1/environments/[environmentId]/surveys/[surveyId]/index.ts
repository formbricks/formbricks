import { getSessionOrUser, hasEnvironmentAccess } from "@/lib/apiHelper";
import { capturePosthogEvent } from "@/lib/posthogServer";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const environmentId = req.query.environmentId?.toString();

  const surveyId = req.query.surveyId?.toString();

  if (environmentId === undefined) {
    return res.status(400).json({ message: "Missing environmentId" });
  }
  if (surveyId === undefined) {
    return res.status(400).json({ message: "Missing surveyId" });
  }

  const hasAccess = await hasEnvironmentAccess(user, environmentId);
  if (hasAccess === false) {
    return res.status(403).json({ message: "Not authorized" });
  }

  // GET
  if (req.method === "GET") {
    const surveys = await prisma.survey.findFirst({
      where: {
        id: surveyId,
        environmentId,
      },
      include: {
        triggers: true,
        displays: true,
      },
    });

    return res.json(surveys);
  }

  // POST
  else if (req.method === "PUT") {
    const currentTriggers = await prisma.surveyTrigger.findMany({
      where: {
        surveyId,
      },
    });
    let data: any = { updatedAt: new Date() };
    const body = { ...req.body };
    if (body.triggers) {
      const newTriggers: string[] = [];
      const removedTriggers: string[] = [];
      // find removed triggers
      for (const eventClassId of body.triggers) {
        if (currentTriggers.find((t) => t.eventClassId === eventClassId)) {
          continue;
        } else {
          newTriggers.push(eventClassId);
        }
      }
      // find removed triggers
      for (const trigger of currentTriggers) {
        if (body.triggers.find((t) => t === trigger.eventClassId)) {
          continue;
        } else {
          removedTriggers.push(trigger.eventClassId);
        }
      }
      // create new triggers
      if (newTriggers.length > 0) {
        data.triggers = {
          ...(data.triggers || []),
          create: newTriggers.map((eventClassId) => ({
            eventClassId,
          })),
        };
      }
      // delete removed triggers
      if (removedTriggers.length > 0) {
        data.triggers = {
          ...(data.triggers || []),
          deleteMany: {
            eventClassId: {
              in: removedTriggers,
            },
          },
        };
      }
      delete body.triggers;
    }
    data = {
      ...data,
      ...body,
    };

    const prismaRes = await prisma.survey.update({
      where: { id: surveyId },
      data,
    });
    return res.json(prismaRes);
  }

  // Delete
  else if (req.method === "DELETE") {
    const prismaRes = await prisma.survey.delete({
      where: { id: surveyId },
    });
    capturePosthogEvent(user.id, "survey deleted", {
      surveyId,
    });
    return res.json(prismaRes);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
