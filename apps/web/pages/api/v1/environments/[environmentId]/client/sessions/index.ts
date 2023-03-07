import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  // GET
  if (req.method === "POST") {
    const { person } = req.body;
    // register new event
    await prisma.event.create({
      data: {
        environment: {
          connect: {
            id: environmentId,
          },
        },
        eventClass: {
          connectOrCreate: {
            where: {
              name_environmentId: {
                name: "New Session",
                environmentId,
              },
            },
            create: {
              name: "New Session",
              type: "automatic",
              environment: {
                connect: {
                  id: environmentId,
                },
              },
            },
          },
        },
        person: {
          connectOrCreate: {
            where: {
              id: person.uuid,
            },
            create: {
              id: person.id,
              environment: {
                connect: {
                  id: environmentId,
                },
              },
              ...person,
            },
          },
        },
      },
    });

    return res.json({});
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
