import { prisma } from "@formbricks/database";
import { capturePosthogEvent } from "@formbricks/lib/posthogServer";
import type { NextApiRequest } from "next";
import { CustomNextApiResponse, responses } from "../../../../../../../lib/api/response";

export default async function handle(req: NextApiRequest, res: CustomNextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  if (!environmentId) {
    return responses.missingFieldResponse(res, "environmentId");
  }

  // CORS
  if (req.method === "OPTIONS") {
    res.status(200).end();
  }

  // POST
  else if (req.method === "POST") {
    const { surveyId, personId } = req.body;

    if (!surveyId) {
      return responses.missingFieldResponse(res, "surveyId");
    }

    // get teamId from environment
    const environment = await prisma.environment.findUnique({
      where: {
        id: environmentId,
      },
      select: {
        product: {
          select: {
            team: {
              select: {
                id: true,
                memberships: {
                  select: {
                    userId: true,
                    role: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!environment) {
      return responses.notFoundResponse(res, "environment", environmentId);
    }

    const teamId = environment.product.team.id;
    // find team owner
    const teamOwnerId = environment.product.team.memberships.find((m) => m.role === "owner")?.userId;

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

    if (teamOwnerId) {
      await capturePosthogEvent(teamOwnerId, "display created", teamId, {
        surveyId,
      });
    } else {
      console.warn("Posthog capture not possible. No team owner found");
    }

    return res.json({
      data: displayData,
    });
  }

  // Unknown HTTP Method
  else {
    return responses.methodNotAllowedResponse(res, ["POST", "OPTIONS"]);
  }
}
