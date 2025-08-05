import { handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { TApiAuditLog, TApiKeyAuthentication, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { validateFileUploads } from "@/lib/fileValidation";
import { deleteResponse, getResponse, updateResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { ZResponseUpdateInput } from "@formbricks/types/responses";

async function fetchAndAuthorizeResponse(
  responseId: string,
  authentication: TApiKeyAuthentication,
  requiredPermission: "GET" | "PUT" | "DELETE"
) {
  if (!authentication) {
    return { error: responses.notAuthenticatedResponse() };
  }

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

export const GET = withV1ApiWrapper({
  handler: async ({
    props,
    authentication,
  }: {
    props: { params: Promise<{ responseId: string }> };
    authentication: TApiKeyAuthentication;
  }) => {
    const params = await props.params;
    try {
      const result = await fetchAndAuthorizeResponse(params.responseId, authentication, "GET");
      if (result.error) {
        return {
          response: result.error,
        };
      }

      return {
        response: responses.successResponse(result.response),
      };
    } catch (error) {
      return {
        response: handleErrorResponse(error),
      };
    }
  },
});

export const DELETE = withV1ApiWrapper({
  handler: async ({
    props,
    auditLog,
    authentication,
  }: {
    props: { params: Promise<{ responseId: string }> };
    auditLog: TApiAuditLog;
    authentication: TApiKeyAuthentication;
  }) => {
    const params = await props.params;
    auditLog.targetId = params.responseId;
    try {
      const result = await fetchAndAuthorizeResponse(params.responseId, authentication, "DELETE");
      if (result.error) {
        return {
          response: result.error,
        };
      }
      auditLog.oldObject = result.response;

      const deletedResponse = await deleteResponse(params.responseId);
      return {
        response: responses.successResponse(deletedResponse),
      };
    } catch (error) {
      return {
        response: handleErrorResponse(error),
      };
    }
  },
  action: "deleted",
  targetType: "response",
});

export const PUT = withV1ApiWrapper({
  handler: async ({
    req,
    props,
    auditLog,
    authentication,
  }: {
    req: NextRequest;
    props: { params: Promise<{ responseId: string }> };
    auditLog: TApiAuditLog;
    authentication: TApiKeyAuthentication;
  }) => {
    const params = await props.params;
    auditLog.targetId = params.responseId;
    try {
      const result = await fetchAndAuthorizeResponse(params.responseId, authentication, "PUT");
      if (result.error) {
        return {
          response: result.error,
        };
      }
      auditLog.oldObject = result.response;

      let responseUpdate;
      try {
        responseUpdate = await req.json();
      } catch (error) {
        logger.error({ error, url: req.url }, "Error parsing JSON");
        return {
          response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
        };
      }

      if (!validateFileUploads(responseUpdate.data, result.survey.questions)) {
        return {
          response: responses.badRequestResponse("Invalid file upload response"),
        };
      }

      const inputValidation = ZResponseUpdateInput.safeParse(responseUpdate);
      if (!inputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(inputValidation.error)
          ),
        };
      }

      const updated = await updateResponse(params.responseId, inputValidation.data);
      auditLog.newObject = updated;
      return {
        response: responses.successResponse(updated),
      };
    } catch (error) {
      return {
        response: handleErrorResponse(error),
      };
    }
  },
  action: "updated",
  targetType: "response",
});
