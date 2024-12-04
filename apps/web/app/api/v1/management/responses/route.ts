import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextRequest } from "next/server";
import { getResponses, getResponsesByEnvironmentId } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { TResponse, ZResponseInput } from "@formbricks/types/responses";
import { createResponse } from "./lib/response";

export const GET = async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const surveyId = searchParams.get("surveyId");
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
  const offset = searchParams.get("skip") ? Number(searchParams.get("skip")) : undefined;

  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    let environmentResponses: TResponse[] = [];

    if (surveyId) {
      environmentResponses = await getResponses(surveyId, limit, offset);
    } else {
      environmentResponses = await getResponsesByEnvironmentId(authentication.environmentId, limit, offset);
    }
    return responses.successResponse(environmentResponses);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};

export const POST = async (request: Request): Promise<Response> => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const environmentId = authentication.environmentId;

    let jsonInput;

    try {
      jsonInput = await request.json();
    } catch (err) {
      console.error(`Error parsing JSON input: ${err}`);
      return responses.badRequestResponse("Malformed JSON input, please check your request body");
    }

    // add environmentId to response
    jsonInput.environmentId = environmentId;

    const inputValidation = ZResponseInput.safeParse(jsonInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const responseInput = inputValidation.data;

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

    // if there is a createdAt but no updatedAt, set updatedAt to createdAt
    if (responseInput.createdAt && !responseInput.updatedAt) {
      responseInput.updatedAt = responseInput.createdAt;
    }

    let response: TResponse;
    try {
      response = await createResponse(inputValidation.data);
    } catch (error) {
      if (error instanceof InvalidInputError) {
        return responses.badRequestResponse(error.message);
      } else {
        console.error(error);
        return responses.internalServerErrorResponse(error.message);
      }
    }

    return responses.successResponse(response, true);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};
