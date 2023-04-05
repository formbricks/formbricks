import { getSessionOrUser, hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

interface FormbricksUser {
  userId: string;
  attributes: { [key: string]: string };
}

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const environmentId = req.query?.environmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  const hasAccess = await hasEnvironmentAccess(user, environmentId);
  if (hasAccess === false) {
    return res.status(403).json({ message: "Not authorized" });
  }

  // POST
  if (req.method === "POST") {
    // lastSyncedAt is the last time the environment was synced (iso string)
    const { users }: { users: FormbricksUser[] } = req.body;

    for (const user of users) {
      // check if user with this userId as attribute already exists
      const existingUser = await prisma.person.findFirst({
        where: {
          attributes: {
            some: {
              attributeClass: {
                name: "userId",
                environmentId,
              },
              value: user.userId,
            },
          },
        },
      });

      if (!existingUser) {
        const attributeType: "noCode" = "noCode";
        // create user with this attributes (create or connect attribute with the same attributeClass name)
        await prisma.person.create({
          data: {
            attributes: {
              create: Object.keys(user.attributes).map((key) => ({
                value: user.attributes[key],
                attributeClass: {
                  connectOrCreate: {
                    where: {
                      name_environmentId: {
                        name: key,
                        environmentId,
                      },
                    },
                    create: {
                      name: key,
                      type: attributeType,
                      environment: {
                        connect: {
                          id: environmentId,
                        },
                      },
                    },
                  },
                },
              })),
            },
            environment: {
              connect: {
                id: environmentId,
              },
            },
          },
        });
      } else {
        // user already exists, update attributes
        const attributeType: "noCode" = "noCode";
        await prisma.person.update({
          where: {
            id: existingUser.id,
          },
          data: {
            attributes: {
              upsert: Object.keys(user.attributes).map((key) => ({
                where: {
                  attributeClassId_personId: {
                    attributeClassId: {
                      name: key,
                      environmentId,
                    },
                    personId: existingUser.id,
                  },
                },
                update: {
                  value: user.attributes[key],
                },
                create: {
                  value: user.attributes[key],
                  attributeClass: {
                    connectOrCreate: {
                      where: {
                        name_environmentId: {
                          name: key,
                          environmentId,
                        },
                      },
                      create: {
                        name: key,
                        type: attributeType,
                        environment: {
                          connect: {
                            id: environmentId,
                          },
                        },
                      },
                    },
                  },
                },
              })),
            },
          },
        });
      }
    }

    return res.status(200).end();
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
