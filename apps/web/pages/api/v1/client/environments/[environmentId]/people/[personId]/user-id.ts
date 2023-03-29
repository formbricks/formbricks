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
    const { userId, sessionId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "Missing userId" });
    }
    if (!sessionId) {
      return res.status(400).json({ message: "Missing sessionId" });
    }
    let returnedPerson;
    // check if person exists
    const existingPerson = await prisma.person.findFirst({
      where: {
        environmentId,
        attributes: {
          some: {
            attributeClass: {
              name: "userId",
            },
            value: userId,
          },
        },
      },
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
    });
    // if person exists, reconnect ression and delete old user
    if (existingPerson) {
      // reconnect session to new person
      await prisma.session.update({
        where: {
          id: sessionId,
        },
        data: {
          person: {
            connect: {
              id: existingPerson.id,
            },
          },
        },
      });

      // delete old person
      await prisma.person.delete({
        where: {
          id: personId,
        },
      });
      returnedPerson = existingPerson;
    } else {
      // update person
      returnedPerson = await prisma.person.update({
        where: {
          id: personId,
        },
        data: {
          attributes: {
            create: {
              value: userId,
              attributeClass: {
                connect: {
                  name_environmentId: {
                    name: "userId",
                    environmentId,
                  },
                },
              },
            },
          },
        },
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
      });
    }

    const settings = await getSettings(environmentId, returnedPerson.id);

    // return updated person and settings
    return res.json({ person: returnedPerson, settings });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
