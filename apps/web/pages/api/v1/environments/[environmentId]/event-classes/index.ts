import { getSessionOrUser, hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const environmentId = req.query.environmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  const hasAccess = await hasEnvironmentAccess(user, environmentId);
  if (hasAccess === false) {
    return res.status(403).json({ message: "Not authorized" });
  }

  // GET
  if (req.method === "GET") {
    const eventClasses = await prisma.eventClass.findMany({
      where: {
        environment: {
          id: environmentId,
        },
      },
      include: {
        _count: {
          select: {
            events: true,
          },
        },
      },
    });

    return res.json(eventClasses);
  }

  // POST
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
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
