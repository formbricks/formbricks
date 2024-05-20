import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { sendToPipeline } from "@/app/lib/pipelines";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { UAParser } from "ua-parser-js";

import { getPerson } from "@formbricks/lib/person/service";
import { capturePosthogEnvironmentEvent } from "@formbricks/lib/posthogServer";
import { createResponseManagement, getResponsesByEnvironmentId } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { TManagementResponseInput, TResponse, ZManagementResponseInput } from "@formbricks/types/responses";

export const GET = async (request: NextRequest) => {
  const surveyId = request.nextUrl.searchParams.get("surveyId");
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    let environmentResponses = await getResponsesByEnvironmentId(authentication.environmentId!);
    if (surveyId) {
      environmentResponses = environmentResponses.filter((response) => response.surveyId === surveyId);
    }
    return responses.successResponse(environmentResponses);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};

// Please use the client API to create a new response

export const POST = async (request: Request): Promise<Response> => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    let responseInput;
    try {
      responseInput = await request.json();
    } catch (err) {
      console.error(`Error parsing JSON input: ${err}`);
      return responses.badRequestResponse("Malformed JSON input, please check your request body");
    }

    const inputValidation = ZManagementResponseInput.safeParse(responseInput);

    // legacy workaround for formbricks-js 1.2.0 & 1.2.1
    if (responseInput.personId && typeof responseInput.personId === "string") {
      const person = await getPerson(responseInput.personId);
      responseInput.userId = person?.userId;
      delete responseInput.personId;
    }

    const agent = UAParser(request.headers.get("user-agent"));
    const country =
      headers().get("CF-IPCountry") ||
      headers().get("X-Vercel-IP-Country") ||
      headers().get("CloudFront-Viewer-Country") ||
      undefined;

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const inputData = inputValidation.data;
    const { environmentId } = inputData;

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
      const meta: TManagementResponseInput["meta"] = {
        source: responseInput?.meta?.source,
        url: responseInput?.meta?.url,
        userAgent: {
          browser: agent?.browser.name,
          device: agent?.device.type,
          os: agent?.os.name,
        },
        country: country,
        action: responseInput?.meta?.action,
      };

      response = await createResponseManagement({
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

    await capturePosthogEnvironmentEvent(survey.environmentId, "response created", {
      surveyId: response.surveyId,
      surveyType: survey.type,
    });

    return responses.successResponse({ id: response.id }, true);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};
