import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { sendToPipeline } from "@/app/lib/pipelines";
import { headers } from "next/headers";
import { UAParser } from "ua-parser-js";

import { capturePosthogEnvironmentEvent } from "@formbricks/lib/posthogServer";
import { createResponseLegacy } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { InvalidInputError } from "@formbricks/types/errors";
import { TResponse, ZResponseLegacyInput } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";

export async function OPTIONS(): Promise<Response> {
  return responses.successResponse({}, true);
}

export async function POST(request: Request): Promise<Response> {
  const responseInput = await request.json();
  if (responseInput.personId === "legacy") {
    responseInput.personId = null;
  }
  const agent = UAParser(request.headers.get("user-agent"));
  const country =
    headers().get("CF-IPCountry") ||
    headers().get("X-Vercel-IP-Country") ||
    headers().get("CloudFront-Viewer-Country") ||
    undefined;
  const inputValidation = ZResponseLegacyInput.safeParse(responseInput);

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
      country: country,
    };

    // check if personId is anonymous
    if (responseInput.personId === "anonymous") {
      // remove this from the request
      responseInput.personId = null;
    }

    response = await createResponseLegacy({
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

  await capturePosthogEnvironmentEvent(survey.environmentId, "response created", {
    surveyId: response.surveyId,
    surveyType: survey.type,
  });

  return responses.successResponse({ id: response.id }, true);
}
