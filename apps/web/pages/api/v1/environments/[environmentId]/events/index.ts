import { hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  const hasAccess = await hasEnvironmentAccess(req, res, environmentId);
  if (!hasAccess) {
    return res.status(403).json({ message: "Not authorized" });
  }

  // GET
  if (req.method === "GET") {
    const events = await prisma.event.findMany({
      where: {
        eventClass: {
          environmentId: environmentId,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
      include: {
        eventClass: true,
      },
    });

    return res.json(events);
  }

  /* // POST
  else if (req.method === "POST") {
    const eventClass = req.body;

    if (eventClass.type === "automatic") {
      res.status(400).json({ message: "You are not allowed to create new automatic events" });
    }

    // create eventClass in db
    const result = await prisma.eventClass.create({
      data: {
        ...eventClass,
        environment: { connect: { id: environmentId } },
      },
    });
    res.json(result);
  } */

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
