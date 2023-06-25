import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";
import { EventType } from "@prisma/client";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  // CORS
  if (req.method === "OPTIONS") {
    res.status(200).end();
  }
  // POST
  else if (req.method === "POST") {
    const { sessionId, eventName, properties } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: "Missing sessionId" });
    }
    if (!eventName) {
      return res.status(400).json({ message: "Missing eventName" });
    }

    let eventType: EventType = EventType.code;
    if (eventName === "Exit Intent (Desktop)" || eventName === "50% Scroll") {
      eventType = EventType.automatic;
    }

    const eventData = await prisma.event.create({
      data: {
        properties,
        session: {
          connect: {
            id: sessionId,
          },
        },
        eventClass: {
          connectOrCreate: {
            where: {
              name_environmentId: {
                name: eventName,
                environmentId,
              },
            },
            create: {
              name: eventName,
              type: eventType,
              environment: {
                connect: {
                  id: environmentId,
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
      },
    });
    return res.json(eventData);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
