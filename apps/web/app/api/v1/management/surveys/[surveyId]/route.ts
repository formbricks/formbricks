import { authenticateRequest, handleErrorResponse, hasPermission } from "@/app/api/v1/auth";
import { deleteSurvey } from "@/app/api/v1/management/surveys/[surveyId]/lib/surveys";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { getMultiLanguagePermission } from "@/modules/ee/license-check/lib/utils";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getSurvey, updateSurvey } from "@formbricks/lib/survey/service";
import { logger } from "@formbricks/logger";
import { ZSurveyUpdateInput } from "@formbricks/types/surveys/types";

export const GET = async (
  request: Request,
  props: { params: Promise<{ surveyId: string }> }
): Promise<Response> => {
  const params = await props.params;
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const survey = await getSurvey(params.surveyId);
    if (survey) {
      if (!hasPermission(authentication.environmentPermissions, survey.environmentId, "GET")) {
        return responses.unauthorizedResponse();
      }
      return responses.successResponse(survey);
    }
    return responses.notFoundResponse("Survey", params.surveyId);
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
    const survey = await getSurvey(params.surveyId);
    if (!survey) {
      return responses.notFoundResponse("Survey", params.surveyId);
    }
    if (!hasPermission(authentication.environmentPermissions, survey.environmentId, "DELETE")) {
      return responses.unauthorizedResponse();
    }
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

    const survey = await getSurvey(params.surveyId);
    if (!survey) {
      return responses.notFoundResponse("Survey", params.surveyId);
    }
    if (!hasPermission(authentication.environmentPermissions, survey.environmentId, "PUT")) {
      return responses.unauthorizedResponse();
    }

    const organization = await getOrganizationByEnvironmentId(survey.environmentId);
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
      ...survey,
      ...surveyUpdate,
    });

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error)
      );
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
