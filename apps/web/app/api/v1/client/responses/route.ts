/*
THIS FILE IS WORK IN PROGRESS
PLEASE DO NOT USE IT YET
*/

import { responses } from "@/lib/api/response";
import { transformErrorToDetails } from "@/lib/api/validator";
import { prisma } from "@formbricks/database";
import { INTERNAL_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { getSurvey } from "@formbricks/lib/services/surveys";
import { TResponseInput, ZResponseInput } from "@formbricks/types/v1/responses";
import { NextResponse } from "next/server";
import type { TResponse } from "@formbricks/types/v1/responses";

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

  /* const teamId = survey.environment.product.team.id;
  // find team owner
  const teamOwnerId = survey.environment.product.team.memberships.find((m) => m.role === "owner")?.userId; */

  const createBody: any = {
    data: {
      survey: {
        connect: {
          id: responseInput.surveyId,
        },
      },
      ...responseInput,
    },
  };

  if (responseInput.personId) {
    createBody.data.person = {
      connect: {
        id: responseInput.personId,
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
        event: "responseFinished",
        data: responseData,
      }),
    });
  }

  /*   captureTelemetry("response created");
  if (teamOwnerId) {
    await capturePosthogEvent(teamOwnerId, "response created", teamId, {
      surveyId: responseInput.surveyId,
      surveyType: survey.type,
    });
  } else {
    console.warn("Posthog capture not possible. No team owner found");
  } */

  return responses.successResponse(responseData, true);
}
