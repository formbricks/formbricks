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

  // POST
  else if (req.method === "POST") {
    const { surveyId, personId } = req.body;

    if (!surveyId) {
      return res.status(400).json({ message: "Missing surveyId" });
    }

    const createBody: any = {
      select: {
        id: true,
      },
      data: {
        status: "seen",
        survey: {
          connect: {
            id: surveyId,
          },
        },
      },
    };

    if (personId) {
      createBody.data.person = {
        connect: {
          id: personId,
        },
      };
    }

    // create new display
    const displayData = await prisma.display.create(createBody);

    return res.json(displayData);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
