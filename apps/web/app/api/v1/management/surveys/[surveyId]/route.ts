import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { deleteSurvey } from "@/app/api/v1/management/surveys/[surveyId]/lib/surveys";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getSurvey, updateSurvey } from "@/lib/survey/service";
import { getIsSpamProtectionEnabled, getMultiLanguagePermission } from "@/modules/ee/license-check/lib/utils";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
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

export const PUT = async (
  request: Request,
  props: { params: Promise<{ surveyId: string }> }
): Promise<Response> => {
  const params = await props.params;
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const result = await fetchAndAuthorizeSurvey(params.surveyId, authentication, "PUT");
    if (result.error) return result.error;

    const organization = await getOrganizationByEnvironmentId(result.survey.environmentId);
    if (!organization) {
      return responses.notFoundResponse("Organization", null);
    }

    let surveyUpdate;
    try {
      surveyUpdate = await request.json();
    } catch (error) {
      logger.error({ error, url: request.url }, "Error parsing JSON input");
      return responses.badRequestResponse("Malformed JSON input, please check your request body");
    }

    const inputValidation = ZSurveyUpdateInput.safeParse({
      ...result.survey,
      ...surveyUpdate,
    });

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error)
      );
    }

    if (surveyUpdate.recaptcha?.enabled) {
      const isSpamProtectionEnabled = await getIsSpamProtectionEnabled();
      if (!isSpamProtectionEnabled) {
        return responses.forbiddenResponse("Spam protection is not enabled for this organization");
      }
    }

    if (surveyUpdate.followUps && surveyUpdate.followUps.length) {
      const isSurveyFollowUpsEnabled = await getSurveyFollowUpsPermission(organization.billing.plan);
      if (!isSurveyFollowUpsEnabled) {
        return responses.forbiddenResponse("Survey follow ups are not enabled for this organization");
      }
    }

    if (surveyUpdate.languages && surveyUpdate.languages.length) {
      const isMultiLanguageEnabled = await getMultiLanguagePermission(organization.billing.plan);
      if (!isMultiLanguageEnabled) {
        return responses.forbiddenResponse("Multi language is not enabled for this organization");
      }
    }

    return responses.successResponse(await updateSurvey({ ...inputValidation.data, id: params.surveyId }));
  } catch (error) {
    return handleErrorResponse(error);
  }
};
