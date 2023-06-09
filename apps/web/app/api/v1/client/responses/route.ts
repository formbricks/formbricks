import { responses } from "@/lib/api/response";
import { prisma } from "@formbricks/database";
import { transformErrorToDetails } from "@/lib/api/validator";
import { createResponse } from "@formbricks/lib/services/response";
import { INTERNAL_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { getSurvey } from "@formbricks/lib/services/survey";
import { TResponseInput, ZResponseInput } from "@formbricks/types/v1/responses";
import { NextResponse } from "next/server";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { capturePosthogEvent } from "@formbricks/lib/posthogServer";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(request: Request): Promise<NextResponse> {
  const responseInput: TResponseInput = await request.json();
  const inputValidation = ZResponseInput.safeParse(responseInput);

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  // check if survey exists
  const survey = await getSurvey(responseInput.surveyId);

  if (!survey) {
    return responses.badRequestResponse(
      "Linked ressource not found",
      {
        surveyId: "Survey not found",
      },
      true
    );
  }

  const environmentId = survey.environmentId;

  // prisma call to get the teamId
  // TODO use services
  const environment = await prisma.environment.findUnique({
    where: { id: environmentId },
    include: {
      product: {
        select: {
          team: {
            select: {
              id: true,
              memberships: {
                where: { role: "owner" },
                select: { userId: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!environment) {
    throw new Error("Environment not found");
  }

  const {
    product: {
      team: { id: teamId, memberships },
    },
  } = environment;

  const teamOwnerId = memberships[0]?.userId;

  const response = await createResponse(responseInput);

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
      surveyId: response.surveyId,
      event: "responseCreated",
      data: response,
    }),
  });

  if (responseInput.finished) {
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
        surveyId: response.surveyId,
        event: "responseFinished",
        data: response,
      }),
    });
  }

  captureTelemetry("response created");
  if (teamOwnerId) {
    await capturePosthogEvent(teamOwnerId, "response created", teamId, {
      surveyId: response.surveyId,
      surveyType: survey.type,
    });
  } else {
    console.warn("Posthog capture not possible. No team owner found");
  }

  return responses.successResponse(response, true);
}
