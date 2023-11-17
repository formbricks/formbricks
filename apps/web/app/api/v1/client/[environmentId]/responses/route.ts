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
import { ZId } from "@formbricks/types/environment";
import { getOrCreatePersonByUserId } from "@formbricks/lib/person/service";
import { TPerson } from "@formbricks/types/people";

interface Context {
  params: {
    environmentId: string;
  };
}

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const { environmentId } = context.params;
  const environmentIdValidation = ZId.safeParse(environmentId);

  if (!environmentIdValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(environmentIdValidation.error),
      true
    );
  }

  const responseInput: TResponseInput = await request.json();
  const agent = UAParser(request.headers.get("user-agent"));
  const inputValidation = ZResponseInput.safeParse({ ...responseInput, environmentId });

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  // get and check survey
  const survey = await getSurvey(responseInput.surveyId);
  if (!survey) {
    return responses.notFoundResponse("Survey", responseInput.surveyId, true);
  }
  if (survey.environmentId !== environmentId) {
    return responses.badRequestResponse(
      "Survey is part of another environment",
      {
        "survey.environmentId": survey.environmentId,
        environmentId,
      },
      true
    );
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

    response = await createResponse({
      ...inputValidation.data,
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
