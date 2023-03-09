import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  const personId = req.query.personId?.toString();

  if (!personId) {
    return res.status(400).json({ message: "Missing personId" });
  }

  // CORS
  if (req.method === "OPTIONS") {
    res.status(200).end();
  }
  // POST
  else if (req.method === "POST") {
    const { key, value } = req.body;
    if (!key || !value) {
      return res.status(400).json({ message: "Missing key or value" });
    }
    const currentPerson = await prisma.person.findUnique({
      where: {
        id: personId,
      },
      select: {
        id: true,
        attributes: {
          select: {
            id: true,
            attributeClass: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!currentPerson) {
      return res.status(400).json({ message: "Person not found" });
    }

    // delete old attribute
    let deleteAttributes: any[] = [];
    const oldAttribute = currentPerson.attributes.find((attribute) => attribute.attributeClass.name === key);
    if (oldAttribute) {
      deleteAttributes = [{ id: oldAttribute.id }];
    }

    // update person
    const updatedPerson = await prisma.person.update({
      where: {
        id: personId,
      },
      data: {
        attributes: {
          deleteMany: [...deleteAttributes],
          create: [
            {
              value: value,
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
      select: {
        id: true,
        userId: true,
        email: true,
        attributes: {
          select: {
            id: true,
            value: true,
            attributeClass: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return res.json(updatedPerson);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
