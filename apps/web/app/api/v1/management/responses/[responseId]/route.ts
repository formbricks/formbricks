import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { ApiAuditLog, withApiLogging } from "@/app/lib/api/with-api-logging";
import { validateFileUploads } from "@/lib/fileValidation";
import { deleteResponse, getResponse, updateResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { logger } from "@formbricks/logger";
import { ZResponseUpdateInput } from "@formbricks/types/responses";

async function fetchAndAuthorizeResponse(
  responseId: string,
  authentication: any,
  requiredPermission: "GET" | "PUT" | "DELETE"
) {
  const response = await getResponse(responseId);
  if (!response) {
    return { error: responses.notFoundResponse("Response", responseId) };
  }

  const survey = await getSurvey(response.surveyId);
  if (!survey) {
    return { error: responses.notFoundResponse("Survey", response.surveyId, true) };
  }

  if (!hasPermission(authentication.environmentPermissions, survey.environmentId, requiredPermission)) {
    return { error: responses.unauthorizedResponse() };
  }

  return { response, survey };
}

export const GET = async (
  request: Request,
  props: { params: Promise<{ responseId: string }> }
): Promise<Response> => {
  const params = await props.params;
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const result = await fetchAndAuthorizeResponse(params.responseId, authentication, "GET");
    if (result.error) return result.error;

    return responses.successResponse(result.response);
  } catch (error) {
    return handleErrorResponse(error);
  }
};

export const DELETE = withApiLogging(
  async (request: Request, props: { params: Promise<{ responseId: string }> }) => {
    const params = await props.params;
    const auditLog: ApiAuditLog = {
      actionType: "response.deleted",
      targetType: "response",
      userId: UNKNOWN_DATA,
      targetId: params.responseId,
      organizationId: UNKNOWN_DATA,
      status: "failure",
      oldObject: undefined,
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

      const result = await fetchAndAuthorizeResponse(params.responseId, authentication, "DELETE");
      if (result.error) {
        return {
          response: result.error,
          audit: auditLog,
        };
      }
      auditLog.oldObject = result.response;

      const deletedResponse = await deleteResponse(params.responseId);
      auditLog.status = "success";
      return {
        response: responses.successResponse(deletedResponse),
        audit: auditLog,
      };
    } catch (error) {
      return {
        response: handleErrorResponse(error),
        audit: auditLog,
      };
    }
  }
);

export const PUT = withApiLogging(
  async (request: Request, props: { params: Promise<{ responseId: string }> }) => {
    const params = await props.params;
    const auditLog: ApiAuditLog = {
      actionType: "response.updated",
      targetType: "response",
      userId: UNKNOWN_DATA,
      targetId: params.responseId,
      organizationId: UNKNOWN_DATA,
      status: "failure",
      oldObject: undefined,
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

      const result = await fetchAndAuthorizeResponse(params.responseId, authentication, "PUT");
      if (result.error) {
        return {
          response: result.error,
          audit: auditLog,
        };
      }
      auditLog.oldObject = result.response;

      let responseUpdate;
      try {
        responseUpdate = await request.json();
      } catch (error) {
        logger.error({ error, url: request.url }, "Error parsing JSON");
        return {
          response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
          audit: auditLog,
        };
      }

      if (!validateFileUploads(responseUpdate.data, result.survey.questions)) {
        return {
          response: responses.badRequestResponse("Invalid file upload response"),
          audit: auditLog,
        };
      }

      const inputValidation = ZResponseUpdateInput.safeParse(responseUpdate);
      if (!inputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(inputValidation.error)
          ),
          audit: auditLog,
        };
      }

      const updated = await updateResponse(params.responseId, inputValidation.data);
      auditLog.status = "success";
      auditLog.newObject = updated;
      return {
        response: responses.successResponse(updated),
        audit: auditLog,
      };
    } catch (error) {
      return {
        response: handleErrorResponse(error),
        audit: auditLog,
      };
    }
  }
);
