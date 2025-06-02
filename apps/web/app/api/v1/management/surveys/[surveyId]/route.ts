import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { deleteSurvey } from "@/app/api/v1/management/surveys/[surveyId]/lib/surveys";
import { checkFeaturePermissions } from "@/app/api/v1/management/surveys/lib/utils";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { ApiAuditLog, withApiLogging } from "@/app/lib/api/with-api-logging";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getSurvey, updateSurvey } from "@/lib/survey/service";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { logger } from "@formbricks/logger";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { ZSurveyUpdateInput } from "@formbricks/types/surveys/types";

const fetchAndAuthorizeSurvey = async (
  surveyId: string,
  authentication: TAuthenticationApiKey,
  requiredPermission: "GET" | "PUT" | "DELETE"
) => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    return { error: responses.notFoundResponse("Survey", surveyId) };
  }
  if (!hasPermission(authentication.environmentPermissions, survey.environmentId, requiredPermission)) {
    return { error: responses.unauthorizedResponse() };
  }

  return { survey };
};

export const GET = async (
  request: Request,
  props: { params: Promise<{ surveyId: string }> }
): Promise<Response> => {
  const params = await props.params;
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const result = await fetchAndAuthorizeSurvey(params.surveyId, authentication, "GET");
    if (result.error) return result.error;
    return responses.successResponse(result.survey);
  } catch (error) {
    return handleErrorResponse(error);
  }
};

export const DELETE = withApiLogging(
  async (request: Request, props: { params: Promise<{ surveyId: string }> }, auditLog: ApiAuditLog) => {
    const params = await props.params;
    auditLog.targetId = params.surveyId;
    try {
      const authentication = await authenticateRequest(request);
      if (!authentication) {
        return {
          response: responses.notAuthenticatedResponse(),
        };
      }
      auditLog.userId = authentication.apiKeyId;
      auditLog.organizationId = authentication.organizationId;

      const result = await fetchAndAuthorizeSurvey(params.surveyId, authentication, "DELETE");
      if (result.error) {
        return {
          response: result.error,
        };
      }
      auditLog.oldObject = result.survey;

      const deletedSurvey = await deleteSurvey(params.surveyId);
      return {
        response: responses.successResponse(deletedSurvey),
      };
    } catch (error) {
      return {
        response: handleErrorResponse(error),
      };
    }
  },
  "deleted",
  "survey"
);

export const PUT = withApiLogging(
  async (request: Request, props: { params: Promise<{ surveyId: string }> }, auditLog: ApiAuditLog) => {
    const params = await props.params;
    auditLog.targetId = params.surveyId;
    try {
      const authentication = await authenticateRequest(request);
      if (!authentication) {
        return {
          response: responses.notAuthenticatedResponse(),
        };
      }
      auditLog.userId = authentication.apiKeyId;

      const result = await fetchAndAuthorizeSurvey(params.surveyId, authentication, "PUT");
      if (result.error) {
        return {
          response: result.error,
        };
      }
      auditLog.oldObject = result.survey;

      const organization = await getOrganizationByEnvironmentId(result.survey.environmentId);
      if (!organization) {
        return {
          response: responses.notFoundResponse("Organization", null),
        };
      }
      auditLog.organizationId = organization.id;

      let surveyUpdate;
      try {
        surveyUpdate = await request.json();
      } catch (error) {
        logger.error({ error, url: request.url }, "Error parsing JSON input");
        return {
          response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
        };
      }

      const inputValidation = ZSurveyUpdateInput.safeParse({
        ...result.survey,
        ...surveyUpdate,
      });

      if (!inputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(inputValidation.error)
          ),
        };
      }

      const featureCheckResult = await checkFeaturePermissions(surveyUpdate, organization);
      if (featureCheckResult) {
        return {
          response: featureCheckResult,
        };
      }

      try {
        const updatedSurvey = await updateSurvey({ ...inputValidation.data, id: params.surveyId });
        auditLog.newObject = updatedSurvey;
        return {
          response: responses.successResponse(updatedSurvey),
        };
      } catch (error) {
        auditLog.status = "failure";
        return {
          response: handleErrorResponse(error),
        };
      }
    } catch (error) {
      auditLog.status = "failure";
      return {
        response: handleErrorResponse(error),
      };
    }
  },
  "updated",
  "survey"
);
