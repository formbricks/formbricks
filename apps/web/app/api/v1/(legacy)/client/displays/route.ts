import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextResponse } from "next/server";

import { createDisplayLegacy } from "@formbricks/lib/display/service";
import { capturePosthogEvent } from "@formbricks/lib/posthogServer";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getTeamDetails } from "@formbricks/lib/teamDetail/service";
import { TDisplay, ZDisplayLegacyCreateInput } from "@formbricks/types/displays";
import { InvalidInputError } from "@formbricks/types/errors";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(request: Request): Promise<NextResponse> {
  const jsonInput = await request.json();
  if (jsonInput.personId === "legacy") {
    delete jsonInput.personId;
  }
  const inputValidation = ZDisplayLegacyCreateInput.safeParse(jsonInput);

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  const { surveyId, responseId } = inputValidation.data;
  let { personId } = inputValidation.data;

  // find environmentId from surveyId
  let survey;

  try {
    survey = await getSurvey(surveyId);
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    } else {
      console.error(error);
      return responses.internalServerErrorResponse(error.message);
    }
  }

  // find teamId & teamOwnerId from environmentId
  const teamDetails = await getTeamDetails(survey.environmentId);

  // create display
  let display: TDisplay;
  try {
    display = await createDisplayLegacy({
      surveyId,
      personId,
      responseId,
    });
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    } else {
      console.error(error);
      return responses.internalServerErrorResponse(error.message);
    }
  }

  if (teamDetails?.teamOwnerId) {
    await capturePosthogEvent(teamDetails.teamOwnerId, "display created", teamDetails.teamId, {
      surveyId,
    });
  } else {
    console.warn("Posthog capture not possible. No team owner found");
  }

  return responses.successResponse({ id: display.id }, true);
}
