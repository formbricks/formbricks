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
      },
    });

    const surveys = await prisma.survey.findMany({
      where: {
        environmentId,
        status: "inProgress",
      },
      select: {
        id: true,
        questions: true,
        triggers: {
          select: {
            id: true,
            eventClass: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const noCodeEvents = await prisma.eventClass.findMany({
      where: {
        environmentId,
        type: "noCode",
      },
      select: {
        name: true,
        noCodeConfig: true,
      },
    });

    const environmentProdut = await prisma.environment.findUnique({
      where: {
        id: environmentId,
      },
      select: {
        product: {
          select: {
            brandColor: true,
          },
        },
      },
    });

    const brandColor = environmentProdut?.product.brandColor;

    return res.json({ session, settings: { surveys, noCodeEvents, brandColor } });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
