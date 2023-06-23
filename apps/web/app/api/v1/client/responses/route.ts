import { responses } from "@/lib/api/response";
import { transformErrorToDetails } from "@/lib/api/validator";
import { sendToPipeline } from "@/lib/pipelines";
import { InvalidInputError } from "@formbricks/errors";
import { capturePosthogEvent } from "@formbricks/lib/posthogServer";
import { createResponse } from "@formbricks/lib/services/response";
import { getSurvey } from "@formbricks/lib/services/survey";
import { getTeamDetails } from "@formbricks/lib/services/teamDetails";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { TResponse, TResponseInput, ZResponseInput } from "@formbricks/types/v1/responses";
import { NextResponse } from "next/server";

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

  let survey;

  try {
    survey = await getSurvey(responseInput.surveyId);
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    } else {
      return responses.internalServerErrorResponse(error.message);
    }
  }

  const teamDetails = await getTeamDetails(survey.environmentId);

  let response: TResponse;
  try {
    response = await createResponse(responseInput);
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    } else {
      return responses.internalServerErrorResponse(error.message);
    }
  }

  sendToPipeline({
    event: "responseCreated",
    environmentId: survey.environmentId,
    surveyId: response.surveyId,
    data: response,
  });

  if (responseInput.finished) {
    sendToPipeline({
      event: "responseFinished",
      environmentId: survey.environmentId,
      surveyId: response.surveyId,
      data: response,
    });
  }

  captureTelemetry("response created");

  if (teamDetails?.teamOwnerId) {
    await capturePosthogEvent(teamDetails.teamOwnerId, "response created", teamDetails.teamId, {
      surveyId: response.surveyId,
      surveyType: survey.type,
    });
  } else {
    console.warn("Posthog capture not possible. No team owner found");
  }

  return responses.successResponse(response, true);
}
