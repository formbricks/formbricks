import { getSessionOrUser } from "@/lib/apiHelper";
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

  const eventClassId = req.query.eventClassId?.toString();

  if (environmentId === undefined) {
    return res.status(400).json({ message: "Missing environmentId" });
  }
  if (eventClassId === undefined) {
    return res.status(400).json({ message: "Missing eventClassId" });
  }

  // GET
  if (req.method === "GET") {
    const eventClass = await prisma.eventClass.findFirst({
      where: {
        id: eventClassId,
        environmentId,
      },
    });

    return res.json(eventClass);
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

    capturePosthogEvent(user.id, "event class updated", {
      eventClassId,
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
    capturePosthogEvent(user.id, "eventClass deleted", {
      eventClassId,
    });
    return res.json(prismaRes);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
