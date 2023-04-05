import { hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  const eventClassId = req.query.eventClassId?.toString();

  if (environmentId === undefined) {
    return res.status(400).json({ message: "Missing environmentId" });
  }
  if (eventClassId === undefined) {
    return res.status(400).json({ message: "Missing eventClassId" });
  }

  const hasAccess = await hasEnvironmentAccess(req, res, environmentId);
  if (!hasAccess) {
    return res.status(403).json({ message: "Not authorized" });
  }

  // GET
  if (req.method === "GET") {
    const eventClass = await prisma.eventClass.findFirst({
      where: {
        id: eventClassId,
        environmentId,
      },
    });

    const numEventsLastHour = await prisma.event.count({
      where: {
        eventClassId,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
    });
    const numEventsLast24Hours = await prisma.event.count({
      where: {
        eventClassId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });
    const numEventsLast7Days = await prisma.event.count({
      where: {
        eventClassId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });
    const activeSurveysData = await prisma.surveyTrigger.findMany({
      where: {
        eventClassId,
        survey: {
          status: "inProgress",
        },
      },
      select: {
        survey: {
          select: {
            name: true,
          },
        },
      },
    });
    const activeSurveys = activeSurveysData.map((t) => t.survey.name);

    const inactiveSurveysData = await prisma.surveyTrigger.findMany({
      where: {
        eventClassId,
        survey: {
          status: {
            in: ["paused", "completed"],
          },
        },
      },
      select: {
        survey: {
          select: {
            name: true,
          },
        },
      },
    });
    const inactiveSurveys = inactiveSurveysData.map((t) => t.survey.name);

    return res.json({
      ...eventClass,
      numEventsLastHour,
      numEventsLast24Hours,
      numEventsLast7Days,
      activeSurveys,
      inactiveSurveys,
    });
  }

  // PUT
  else if (req.method === "PUT") {
    const currentEventClass = await prisma.eventClass.findUnique({
      where: {
        id: eventClassId,
      },
    });
    if (currentEventClass === null) {
      return res.status(404).json({ message: "Event class not found" });
    }
    if (currentEventClass.type === "automatic") {
      return res.status(403).json({ message: "Automatic event classes cannot be updated" });
    }

    const eventClass = await prisma.eventClass.update({
      where: {
        id: eventClassId,
      },
      data: {
        ...req.body,
      },
    });

    return res.json(eventClass);
  }

  // Delete
  else if (req.method === "DELETE") {
    const currentEventClass = await prisma.eventClass.findFirst({
      where: {
        id: eventClassId,
        environmentId,
      },
    });
    if (currentEventClass === null) {
      return res.status(404).json({ message: "Event class not found" });
    }
    if (currentEventClass.type === "automatic") {
      return res.status(403).json({ message: "Automatic event classes cannot be deleted" });
    }

    const prismaRes = await prisma.survey.delete({
      where: { id: eventClassId },
    });
    return res.json(prismaRes);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
