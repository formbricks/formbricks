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

export const DELETE = async (
  request: Request,
  props: { params: Promise<{ surveyId: string }> }
): Promise<Response> => {
  const params = await props.params;
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const result = await fetchAndAuthorizeSurvey(params.surveyId, authentication, "DELETE");
    if (result.error) return result.error;
    const deletedSurvey = await deleteSurvey(params.surveyId);
    return responses.successResponse(deletedSurvey);
  } catch (error) {
    return handleErrorResponse(error);
  }
};

export const PUT = withApiLogging(
  async (request: Request, props: { params: Promise<{ surveyId: string }> }) => {
    const auditLog: ApiAuditLog = {
      actionType: "survey.updated",
      targetType: "survey",
      userId: "unknown",
      targetId: undefined,
      organizationId: "unknown",
      status: "failure",
      oldObject: undefined,
      newObject: undefined,
    };

    const params = await props.params;
    try {
      const authentication = await authenticateRequest(request);
      if (!authentication) {
        return {
          response: responses.notAuthenticatedResponse(),
          audit: auditLog,
        };
      }
      auditLog.userId = authentication.apiKeyId;
      auditLog.targetId = params.surveyId;

      const result = await fetchAndAuthorizeSurvey(params.surveyId, authentication, "PUT");
      if (result.error) {
        return {
          response: result.error,
          audit: auditLog,
        };
      }
      auditLog.oldObject = result.survey;

      const organization = await getOrganizationByEnvironmentId(result.survey.environmentId);
      if (!organization) {
        return {
          response: responses.notFoundResponse("Organization", null),
          audit: auditLog,
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
          audit: auditLog,
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
          audit: auditLog,
        };
      }

      const featureCheckResult = await checkFeaturePermissions(surveyUpdate, organization);
      if (featureCheckResult) {
        return {
          response: featureCheckResult,
          audit: auditLog,
        };
      }

      try {
        const updatedSurvey = await updateSurvey({ ...inputValidation.data, id: params.surveyId });
        auditLog.status = "success";
        auditLog.newObject = updatedSurvey;
        return {
          response: responses.successResponse(updatedSurvey),
          audit: auditLog,
        };
      } catch (error) {
        auditLog.status = "failure";
        return {
          response: handleErrorResponse(error),
          audit: auditLog,
        };
      }
    } catch (error) {
      auditLog.status = "failure";
      return {
        response: handleErrorResponse(error),
        audit: auditLog,
      };
    }
  }
);
