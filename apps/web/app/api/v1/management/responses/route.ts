import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { validateFileUploads } from "@/lib/fileValidation";
import { getResponses } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { TResponse, TResponseInput, ZResponseInput } from "@formbricks/types/responses";
import { createResponse, getResponsesByEnvironmentIds } from "./lib/response";

export const GET = async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const surveyId = searchParams.get("surveyId");
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
  const offset = searchParams.get("skip") ? Number(searchParams.get("skip")) : undefined;

  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    let allResponses: TResponse[] = [];

    if (surveyId) {
      const survey = await getSurvey(surveyId);
      if (!survey) {
        return responses.notFoundResponse("Survey", surveyId, true);
      }
      if (!hasPermission(authentication.environmentPermissions, survey.environmentId, "GET")) {
        return responses.unauthorizedResponse();
      }
      const surveyResponses = await getResponses(surveyId, limit, offset);
      allResponses.push(...surveyResponses);
    } else {
      const environmentIds = authentication.environmentPermissions.map(
        (permission) => permission.environmentId
      );
      const environmentResponses = await getResponsesByEnvironmentIds(environmentIds, limit, offset);
      allResponses.push(...environmentResponses);
    }
    return responses.successResponse(allResponses);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};

const validateInput = async (request: Request) => {
  let jsonInput;
  try {
    jsonInput = await request.json();
  } catch (err) {
    logger.error({ error: err, url: request.url }, "Error parsing JSON input");
    return { error: responses.badRequestResponse("Malformed JSON input, please check your request body") };
  }

  const inputValidation = ZResponseInput.safeParse(jsonInput);
  if (!inputValidation.success) {
    return {
      error: responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      ),
    };
  }

  return { data: inputValidation.data };
};

const validateSurvey = async (responseInput: TResponseInput, environmentId: string) => {
  const survey = await getSurvey(responseInput.surveyId);
  if (!survey) {
    return { error: responses.notFoundResponse("Survey", responseInput.surveyId, true) };
  }
  if (survey.environmentId !== environmentId) {
    return {
      error: responses.badRequestResponse(
        "Survey is part of another environment",
        {
          "survey.environmentId": survey.environmentId,
          environmentId,
        },
        true
      ),
    };
  }
  return { survey };
};

export const POST = async (request: Request): Promise<Response> => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const inputResult = await validateInput(request);
    if (inputResult.error) return inputResult.error;

    const responseInput = inputResult.data;
    const environmentId = responseInput.environmentId;

    if (!hasPermission(authentication.environmentPermissions, environmentId, "POST")) {
      return responses.unauthorizedResponse();
    }

    const surveyResult = await validateSurvey(responseInput, environmentId);
    if (surveyResult.error) return surveyResult.error;

    if (!validateFileUploads(responseInput.data, surveyResult.survey.questions)) {
      return responses.badRequestResponse("Invalid file upload response");
    }

    if (responseInput.createdAt && !responseInput.updatedAt) {
      responseInput.updatedAt = responseInput.createdAt;
    }

    try {
      const response = await createResponse(responseInput);
      return responses.successResponse(response, true);
    } catch (error) {
      if (error instanceof InvalidInputError) {
        return responses.badRequestResponse(error.message);
      }
      logger.error({ error, url: request.url }, "Error in POST /api/v1/management/responses");
      return responses.internalServerErrorResponse(error.message);
    }
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};
