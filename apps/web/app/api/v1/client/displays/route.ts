import { responses } from "@/lib/api/response";
import { transformErrorToDetails } from "@/lib/api/validator";
import { InvalidInputError } from "@formbricks/types/v1/errors";
import { capturePosthogEvent } from "@formbricks/lib/posthogServer";
import { createDisplay } from "@formbricks/lib/display/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getTeamDetails } from "@formbricks/lib/teamDetail/service";
import { TDisplay, ZDisplayInput } from "@formbricks/types/v1/displays";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(request: Request): Promise<NextResponse> {
  const jsonInput: unknown = await request.json();
  const inputValidation = ZDisplayInput.safeParse(jsonInput);

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  const displayInput = inputValidation.data;

  // find environmentId from surveyId
  let survey;

  try {
    survey = await getSurvey(displayInput.surveyId);
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    } else {
      return responses.internalServerErrorResponse(error.message);
    }
  }

  // find teamId & teamOwnerId from environmentId
  const teamDetails = await getTeamDetails(survey.environmentId);

  // create display
  let display: TDisplay;
  try {
    display = await createDisplay(displayInput);
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    } else {
      return responses.internalServerErrorResponse(error.message);
    }
  }

  if (teamDetails?.teamOwnerId) {
    await capturePosthogEvent(teamDetails.teamOwnerId, "display created", teamDetails.teamId, {
      surveyId: displayInput.surveyId,
    });
  } else {
    console.warn("Posthog capture not possible. No team owner found");
  }

  return responses.successResponse(
    {
      ...display,
      createdAt: display.createdAt.toISOString(),
      updatedAt: display.updatedAt.toISOString(),
    },
    true
  );
}
