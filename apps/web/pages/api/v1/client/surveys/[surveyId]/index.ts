import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const surveyId = req.query.surveyId?.toString();

  if (!surveyId) {
    return res.status(400).json({ message: "Missing surveyId" });
  }

  // CORS
  if (req.method === "OPTIONS") {
    res.status(200).end();
  }
  // GET
  else if (req.method === "GET") {
    // get survey
    const survey = await prisma.survey.findFirst({
      where: {
        id: surveyId,
        type: "link",
        status: "inProgress",
      },
      select: {
        id: true,
        questions: true,
        environmentId: true,
      },
    });

    // if survey does not exist, return 404
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    // get brandColor from product using environmentId
    const product = await prisma.product.findFirst({
      where: {
        environments: {
          some: {
            id: survey.environmentId,
          },
        },
      },
      select: {
        brandColor: true,
      },
    });

    // if survey exists, return survey
    return res.status(200).json({ ...survey, brandColor: product?.brandColor });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
