import { sendToPipeline } from "@/app/lib/pipelines";
import type { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "@formbricks/database";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { transformPrismaPerson } from "@formbricks/lib/person/service";
import { capturePosthogEnvironmentEvent } from "@formbricks/lib/posthogServer";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { TResponse } from "@formbricks/types/responses";
import { TTag } from "@formbricks/types/tags";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  // CORS
  if (req.method === "OPTIONS") {
    return res.status(200).end();
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
    const environment = await getEnvironment(environmentId);
    if (!environment) {
      return res.status(404).json({ message: "Environment not found" });
    }
    // find team owner

    const responseInput = {
      survey: {
        connect: {
          id: surveyId,
        },
      },
      ...response,
    };

    if (personId) {
      responseInput.data.person = {
        connect: {
          id: personId,
        },
      };
    }

    // create new response
    const responsePrisma = await prisma.response.create({
      data: {
        ...responseInput,
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        surveyId: true,
        finished: true,
        data: true,
        ttc: true,
        meta: true,
        personAttributes: true,
        singleUseId: true,
        person: {
          select: {
            id: true,
            userId: true,
            environmentId: true,
            createdAt: true,
            updatedAt: true,
            attributes: {
              select: {
                value: true,
                attributeClass: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        notes: {
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            text: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
            isResolved: true,
            isEdited: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                createdAt: true,
                updatedAt: true,
                name: true,
                environmentId: true,
              },
            },
          },
        },
      },
    });

    const responseData: TResponse = {
      ...responsePrisma,
      person: responsePrisma.person ? transformPrismaPerson(responsePrisma.person) : null,
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };

    // send response to pipeline
    // don't await to not block the response
    sendToPipeline({
      environmentId,
      surveyId,
      event: "responseCreated",
      response: responseData,
    });

    if (response.finished) {
      // send response to pipeline
      // don't await to not block the response
      sendToPipeline({
        environmentId,
        surveyId,
        event: "responseFinished",
        response: responseData,
      });
    }

    captureTelemetry("response created");
    await capturePosthogEnvironmentEvent(environmentId, "response created", {
      surveyId,
      surveyType: survey.type,
    });

    return res.json({ id: responseData.id });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
