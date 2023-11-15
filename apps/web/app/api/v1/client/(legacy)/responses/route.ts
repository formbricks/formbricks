import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { sendToPipeline } from "@/app/lib/pipelines";
import { InvalidInputError } from "@formbricks/types/errors";
import { capturePosthogEvent } from "@formbricks/lib/posthogServer";
import { getSurvey } from "@formbricks/lib/survey/service";
import { createResponse } from "@formbricks/lib/response/service";
import { getTeamDetails } from "@formbricks/lib/teamDetail/service";
import { TResponse, TResponseInput, ZResponseInput } from "@formbricks/types/responses";
import { NextResponse } from "next/server";
import { UAParser } from "ua-parser-js";
import { TSurvey } from "@formbricks/types/surveys";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(request: Request): Promise<NextResponse> {
  const responseInput: TResponseInput = await request.json();
  if (responseInput.personId === "legacy") {
    responseInput.personId = null;
  }
  const agent = UAParser(request.headers.get("user-agent"));
  const inputValidation = ZResponseInput.safeParse(responseInput);

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  let survey: TSurvey | null;

  try {
    survey = await getSurvey(responseInput.surveyId);
    if (!survey) {
      return responses.notFoundResponse("Survey", responseInput.surveyId);
    }
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    } else {
      console.error(error);
      return responses.internalServerErrorResponse(error.message);
    }
  }

  const teamDetails = await getTeamDetails(survey.environmentId);

  let response: TResponse;
  try {
    const meta = {
      source: responseInput?.meta?.source,
      url: responseInput?.meta?.url,
      userAgent: {
        browser: agent?.browser.name,
        device: agent?.device.type,
        os: agent?.os.name,
      },
    };

    // check if personId is anonymous
    if (responseInput.personId === "anonymous") {
      // remove this from the request
      responseInput.personId = null;
    }

    response = await createResponse({
      ...responseInput,
      meta,
    });
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    } else {
      console.error(error);
      return responses.internalServerErrorResponse(error.message);
    }
  }

  sendToPipeline({
    event: "responseCreated",
    environmentId: survey.environmentId,
    surveyId: response.surveyId,
    response: response,
  });

  if (responseInput.finished) {
    sendToPipeline({
      event: "responseFinished",
      environmentId: survey.environmentId,
      surveyId: response.surveyId,
      response: response,
    });
  }

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
