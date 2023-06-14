import { hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  const personId = req.query.personId?.toString();

  if (environmentId === undefined) {
    return res.status(400).json({ message: "Missing environmentId" });
  }
  if (personId === undefined) {
    return res.status(400).json({ message: "Missing personId" });
  }

  const hasAccess = await hasEnvironmentAccess(req, res, environmentId);
  if (!hasAccess) {
    return res.status(403).json({ message: "Not authorized" });
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
        createdAt: true,
        updatedAt: true,
        responses: {
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            data: true,
            survey: {
              select: {
                id: true,
                questions: true,
                name: true,
                status: true,
              },
            },
          },
        },
        sessions: {
          select: {
            events: {
              select: {
                id: true,
                createdAt: true,
                eventClass: {
                  select: {
                    name: true,
                    description: true,
                    type: true,
                  },
                },
              },
            },
          },
        },
        attributes: {
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            value: true,
            attributeClass: {
              select: {
                name: true,
                description: true,
                archived: true,
              },
            },
          },
        },
        displays: {
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            surveyId: true,
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
    return res.json(prismaRes);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
