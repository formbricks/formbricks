import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { ApiAuditLog, withApiLogging } from "@/app/lib/api/with-api-logging";
import { validateFileUploads } from "@/lib/fileValidation";
import { getResponses } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
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

export const POST = withApiLogging(async (request: Request) => {
  const auditLog: ApiAuditLog = {
    actionType: "response.created",
    targetType: "response",
    userId: UNKNOWN_DATA,
    targetId: UNKNOWN_DATA,
    organizationId: UNKNOWN_DATA,
    status: "failure",
    newObject: undefined,
  };
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) {
      return {
        response: responses.notAuthenticatedResponse(),
        audit: auditLog,
      };
    }
    auditLog.userId = authentication.apiKeyId;
    auditLog.organizationId = authentication.organizationId;

    const inputResult = await validateInput(request);
    if (inputResult.error) {
      return {
        response: inputResult.error,
        audit: auditLog,
      };
    }

    const responseInput = inputResult.data;
    const environmentId = responseInput.environmentId;

    if (!hasPermission(authentication.environmentPermissions, environmentId, "POST")) {
      return {
        response: responses.unauthorizedResponse(),
        audit: auditLog,
      };
    }

    const surveyResult = await validateSurvey(responseInput, environmentId);
    if (surveyResult.error) {
      return {
        response: surveyResult.error,
        audit: auditLog,
      };
    }

    if (!validateFileUploads(responseInput.data, surveyResult.survey.questions)) {
      return {
        response: responses.badRequestResponse("Invalid file upload response"),
        audit: auditLog,
      };
    }

    if (responseInput.createdAt && !responseInput.updatedAt) {
      responseInput.updatedAt = responseInput.createdAt;
    }

    try {
      const response = await createResponse(responseInput);
      auditLog.status = "success";
      auditLog.targetId = response.id;
      auditLog.newObject = response;
      return {
        response: responses.successResponse(response, true),
        audit: auditLog,
      };
    } catch (error) {
      if (error instanceof InvalidInputError) {
        return {
          response: responses.badRequestResponse(error.message),
          audit: auditLog,
        };
      }
      logger.error({ error, url: request.url }, "Error in POST /api/v1/management/responses");
      return {
        response: responses.internalServerErrorResponse(error.message),
        audit: auditLog,
      };
    }
  } catch (error) {
    if (error instanceof DatabaseError) {
      return {
        response: responses.badRequestResponse(error.message),
        audit: auditLog,
      };
    }
    throw error;
  }
});
