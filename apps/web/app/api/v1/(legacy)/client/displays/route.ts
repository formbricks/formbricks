import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";

import { createDisplayLegacy } from "@formbricks/lib/display/service";
import { capturePosthogEnvironmentEvent } from "@formbricks/lib/posthogServer";
import { getSurvey } from "@formbricks/lib/survey/service";
import { TDisplay, ZDisplayLegacyCreateInput } from "@formbricks/types/displays";
import { InvalidInputError } from "@formbricks/types/errors";

export async function OPTIONS(): Promise<Response> {
  return responses.successResponse({}, true);
}

export async function POST(request: Request): Promise<Response> {
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

  await capturePosthogEnvironmentEvent(survey.environmentId, "display created", {
    surveyId,
  });

  return responses.successResponse({ id: display.id }, true);
}
