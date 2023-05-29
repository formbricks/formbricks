/*
THIS FILE IS WORK IN PROGRESS
PLEASE DO NOT USE IT YET
*/

import { responses } from "@/lib/api/response";
import { prisma } from "@formbricks/database";
import { INTERNAL_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { NextResponse } from "next/server";
import { capturePosthogEvent } from "@formbricks/lib/posthogServer";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(request: Request): Promise<NextResponse> {
  const { surveyId, userCuid, response } = await request.json();

  if (!surveyId) {
    return responses.missingFieldResponse("surveyId", true);
  }

  if (!response) {
    return responses.missingFieldResponse("response", true);
  }

  // userCuid can be null, e.g. for link surveys

  // check if survey exists
  const survey = await prisma.survey.findUnique({
    where: {
      id: surveyId,
    },
    select: {
      id: true,
      environment: {
        select: {
          id: true,
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
      },
      type: true,
    },
  });

  if (!survey) {
    return responses.notFoundResponse("Survey", surveyId, true);
  }

  const environmentId = survey.environment.id;

  const teamId = survey.environment.product.team.id;
  // find team owner
  const teamOwnerId = survey.environment.product.team.memberships.find((m) => m.role === "owner")?.userId;

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

  if (userCuid) {
    createBody.data.person = {
      connect: {
        id: userCuid,
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

  return responses.successResponse({ id: responseData.id }, true);
}
