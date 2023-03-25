import { getSettings } from "@/lib/api/clientSettings";
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
        environmentId: true,
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

    // find attribute class
    let attributeClass = await prisma.attributeClass.findUnique({
      where: {
        name_environmentId: {
          name: key,
          environmentId,
        },
      },
      select: {
        id: true,
      },
    });

    // create new attribute class if not found
    if (attributeClass === null) {
      attributeClass = await prisma.attributeClass.create({
        data: {
          name: key,
          type: "code",
          environment: {
            connect: {
              id: environmentId,
            },
          },
        },
        select: {
          id: true,
        },
      });
    }

    // upsert attribute (update or create)
    const attribute = await prisma.attribute.upsert({
      where: {
        attributeClassId_personId: {
          attributeClassId: attributeClass.id,
          personId,
        },
      },
      update: {
        value,
      },
      create: {
        attributeClass: {
          connect: {
            id: attributeClass.id,
          },
        },
        person: {
          connect: {
            id: personId,
          },
        },
        value,
      },
      select: {
        person: {
          select: {
            id: true,
            environmentId: true,
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
        },
      },
    });

    const person = attribute.person;

    const settings = await getSettings(environmentId, person.id);

    // return updated person
    return res.json({ person, settings });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
