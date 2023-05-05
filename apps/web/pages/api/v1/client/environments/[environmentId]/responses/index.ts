import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { capturePosthogEvent } from "@formbricks/lib/posthogServer";
import { INTERNAL_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";

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
    if (!response) {
      return res.status(400).json({ message: "Missing data" });
    }
    // personId can be null, e.g. for link surveys

    // check if survey exists
    const survey = await prisma.survey.findUnique({
      where: {
        id: surveyId,
      },
      select: {
        id: true,
        type: true,
      },
    });

    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
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
      return res.status(404).json({ message: "Environment not found" });
    }

    const teamId = environment.product.team.id;
    // find team owner
    const teamOwnerId = environment.product.team.memberships.find((m) => m.role === "owner")?.userId;

    const createBody = {
      data: {
        survey: {
          connect: {
            id: surveyId,
          },
        },
        ...response,
      },
    };

    if (personId) {
      createBody.data.person = {
        connect: {
          id: personId,
        },
      };
    }

    // create new response
    const responseData = await prisma.response.create(createBody);

    // send response to pipeline
    // don't await to not block the response
    fetch(`${WEBAPP_URL}/api/pipeline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internalSecret: INTERNAL_SECRET,
        environmentId,
        event: "responseCreated",
        data: responseData,
      }),
    });

    if (response.finished) {
      // send response to pipeline
      // don't await to not block the response
      fetch(`${WEBAPP_URL}/api/pipeline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          internalSecret: INTERNAL_SECRET,
          environmentId,
          event: "responseFinished",
          data: responseData,
        }),
      });
    }

    captureTelemetry("response created");
    if (teamOwnerId) {
      await capturePosthogEvent(teamOwnerId, "response created", teamId, {
        surveyId,
        surveyType: survey.type,
      });
    } else {
      console.warn("Posthog capture not possible. No team owner found");
    }

    return res.json({ id: responseData.id });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
