import { hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";

import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();
  const surveyId = req.query.surveyId?.toString();

  if (environmentId === undefined) {
    return res.status(400).json({ message: "Missing environmentId" });
  }
  if (surveyId === undefined) {
    return res.status(400).json({ message: "Missing surveyId" });
  }

  const hasAccess = await hasEnvironmentAccess(req, res, environmentId);
  if (!hasAccess) {
    return res.status(403).json({ message: "Not authorized" });
  }

  // GET
  if (req.method === "GET") {
    // get responses
    const responses = await prisma.response.findMany({
      where: {
        survey: {
          id: surveyId,
        },
      },
      orderBy: [
        {
          createdAt: "desc",
        },
      ],
      include: {
        person: {
          include: {
            attributes: {
              select: {
                attributeClass: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                value: true,
              },
            },
          },
        },
        notes: {
          include: {
            response: true,
            user: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                name: true,
                createdAt: true,
                environmentId: true,
                id: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

    return res.json({ count: responses.length, responses, reachedLimit: false });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
