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
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: "Missing sessionId" });
    }

    // get session
    const session = await prisma.session.findUnique({
      where: {
        id: sessionId,
      },
      select: {
        person: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!session) {
      return res.status(400).json({ message: "Session not found" });
    }

    const personId = session.person.id;

    // get recontactDays from product
    const product = await prisma.product.findFirst({
      where: {
        environments: {
          some: {
            id: environmentId,
          },
        },
      },
      select: {
        recontactDays: true,
      },
    });

    if (!product) {
      return res.status(400).json({ message: "Product not found" });
    }

    // get all surveys that meed the displayOption criteria
    const potentialSurveys = await prisma.survey.findMany({
      where: {
        OR: [
          {
            environmentId,
            type: "web",
            status: "inProgress",
            displayOption: "respondMultiple",
          },
          {
            environmentId,
            type: "web",
            status: "inProgress",
            displayOption: "displayOnce",
            displays: { none: { personId } },
          },
          {
            environmentId,
            type: "web",
            status: "inProgress",
            displayOption: "displayMultiple",
            displays: { none: { personId, status: "responded" } },
          },
        ],
      },
      select: {
        id: true,
        questions: true,
        recontactDays: true,
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
        // last display
        displays: {
          where: {
            personId,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            createdAt: true,
          },
        },
      },
    });

    // filter surveys that meet the recontactDays criteria
    const surveys = potentialSurveys
      .filter((survey) => {
        const lastDisplay = survey.displays[0];
        if (!lastDisplay) {
          // no display yet - always display
          return true;
        } else if (survey.recontactDays !== null) {
          // if recontactDays is set on survey, use that
          const lastDisplayDate = new Date(lastDisplay.createdAt);
          const currentDate = new Date();
          const diffTime = Math.abs(currentDate.getTime() - lastDisplayDate.getTime());
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          return diffDays >= survey.recontactDays;
        } else if (product.recontactDays !== null) {
          // if recontactDays is not set in survey, use product recontactDays
          const lastDisplayDate = new Date(lastDisplay.createdAt);
          const currentDate = new Date();
          const diffTime = Math.abs(currentDate.getTime() - lastDisplayDate.getTime());
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          return diffDays >= product.recontactDays;
        } else {
          // if recontactDays is not set in survey or product, always display
          return true;
        }
      })
      .map((survey) => {
        return {
          id: survey.id,
          questions: survey.questions,
          triggers: survey.triggers,
        };
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

    return res.json({ surveys, noCodeEvents, brandColor });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
