import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";
import { captureTelemetry } from "@formbricks/lib/telemetry";

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
    const { surveyId, personId, response } = req.body;

    if (!surveyId) {
      return res.status(400).json({ message: "Missing surveyId" });
    }
    if (!personId) {
      return res.status(400).json({ message: "Missing personId" });
    }
    if (!response) {
      return res.status(400).json({ message: "Missing data" });
    }

    // create new response
    const responseData = await prisma.response.create({
      select: {
        id: true,
      },
      data: {
        survey: {
          connect: {
            id: surveyId,
          },
        },
        person: {
          connect: {
            id: personId,
          },
        },
        ...response,
      },
    });

    captureTelemetry("response created");

    return res.json(responseData);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
