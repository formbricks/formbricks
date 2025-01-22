import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { sendToPipeline } from "@/app/lib/pipelines";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { headers } from "next/headers";
import { UAParser } from "ua-parser-js";
import { capturePosthogEnvironmentEvent } from "@formbricks/lib/posthogServer";
import { getSurvey } from "@formbricks/lib/survey/service";
import { ZId } from "@formbricks/types/common";
import { InvalidInputError } from "@formbricks/types/errors";
import { TResponse, TResponseInput, ZResponseInput } from "@formbricks/types/responses";
import { createResponse } from "./lib/response";

interface Context {
  params: Promise<{
    environmentId: string;
  }>;
}

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const POST = async (request: Request, context: Context): Promise<Response> => {
  const params = await context.params;
  const requestHeaders = await headers();

  const { environmentId } = params;
  const environmentIdValidation = ZId.safeParse(environmentId);

  if (!environmentIdValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(environmentIdValidation.error),
      true
    );
  }

  const responseInput = await request.json();

  const agent = UAParser(request.headers.get("user-agent"));
  const country =
    requestHeaders.get("CF-IPCountry") ||
    requestHeaders.get("X-Vercel-IP-Country") ||
    requestHeaders.get("CloudFront-Viewer-Country") ||
    undefined;
  const inputValidation = ZResponseInput.safeParse({ ...responseInput, environmentId });

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  if (inputValidation.data.userId) {
    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("User identification is only available for enterprise users.", true);
    }
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

  let response: TResponse;
  try {
    const meta: TResponseInput["meta"] = {
      source: responseInput?.meta?.source,
      url: responseInput?.meta?.url,
      userAgent: {
        browser: agent?.browser.name,
        device: agent?.device.type || "desktop",
        os: agent?.os.name,
      },
      country: country,
      action: responseInput?.meta?.action,
    };

    response = await createResponse({
      ...inputValidation.data,
      meta,
      panelistId: inputValidation.data.userId || "",
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
};
