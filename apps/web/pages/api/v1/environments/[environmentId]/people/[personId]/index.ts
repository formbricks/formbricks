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

  const personId = req.query.personId?.toString();

  if (environmentId === undefined) {
    return res.status(400).json({ message: "Missing environmentId" });
  }
  if (personId === undefined) {
    return res.status(400).json({ message: "Missing personId" });
  }

  // GET
  if (req.method === "GET") {
    const persons = await prisma.person.findFirst({
      where: {
        id: personId,
        environmentId,
      },
      select: {
        id: true,
        userId: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        responses: {
          select: {
            createdAt: true,
            updatedAt: true,
            data: true,
          },
        },
        sessions: {
          select: {
            events: {
              select: {
                createdAt: true,
                eventClass: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!persons) {
      return res.status(404).json({ message: "Person not found" });
    }

    return res.json(persons);
  }

  // POST
  else if (req.method === "PUT") {
    const data = { ...req.body, updatedAt: new Date() };
    const prismaRes = await prisma.person.update({
      where: { id: personId },
      data,
    });
    return res.json(prismaRes);
  }

  // Delete
  else if (req.method === "DELETE") {
    const prismaRes = await prisma.person.delete({
      where: { id: personId },
    });
    capturePosthogEvent(user.id, "person deleted", {
      personId,
    });
    return res.json(prismaRes);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
