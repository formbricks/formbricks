import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  // CORS
  if (req.method === "OPTIONS") {
    res.status(200).end();
  }
  // GET
  else if (req.method === "POST") {
    const { personId } = req.body;

    if (!personId) {
      return res.status(400).json({ message: "Missing personId" });
    }

    // create new session
    const session = await prisma.session.create({
      data: {
        person: {
          connect: {
            id: personId,
          },
        },
        events: {
          create: [
            {
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
            },
          ],
        },
      },
    });

    return res.json(session);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
