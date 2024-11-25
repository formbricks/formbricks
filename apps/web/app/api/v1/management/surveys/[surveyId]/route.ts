import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import {
  getMultiLanguagePermission,
  getSurveyFollowUpsPermission,
} from "@/modules/ee/license-check/lib/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { deleteSurvey, getSurvey, updateSurvey } from "@formbricks/lib/survey/service";
import { TSurvey, ZSurveyUpdateInput } from "@formbricks/types/surveys/types";

const fetchAndAuthorizeSurvey = async (authentication: any, surveyId: string): Promise<TSurvey | null> => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    return null;
  }
  if (survey.environmentId !== authentication.environmentId) {
    throw new Error("Unauthorized");
  }
  return survey;
};

export const GET = async (
  request: Request,
  props: { params: Promise<{ surveyId: string }> }
): Promise<Response> => {
  const params = await props.params;
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const survey = await fetchAndAuthorizeSurvey(authentication, params.surveyId);
    if (survey) {
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
    const survey = await fetchAndAuthorizeSurvey(authentication, params.surveyId);
    if (!survey) {
      return responses.notFoundResponse("Survey", params.surveyId);
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

    const survey = await fetchAndAuthorizeSurvey(authentication, params.surveyId);
    if (!survey) {
      return responses.notFoundResponse("Survey", params.surveyId);
    }

    const organization = await getOrganizationByEnvironmentId(authentication.environmentId);
    if (!organization) {
      return responses.notFoundResponse("Organization", null);
    }

    let surveyUpdate;
    try {
      surveyUpdate = await request.json();
    } catch (error) {
      console.error(`Error parsing JSON input: ${error}`);
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
      const isSurveyFollowUpsEnabled = await getSurveyFollowUpsPermission(organization);
      if (!isSurveyFollowUpsEnabled) {
        return responses.forbiddenResponse("Survey follow ups are not enabled for this organization");
      }
    }

    if (surveyUpdate.languages && surveyUpdate.languages.length) {
      const isMultiLanguageEnabled = await getMultiLanguagePermission(organization);
      if (!isMultiLanguageEnabled) {
        return responses.forbiddenResponse("Multi language is not enabled for this organization");
      }
    }

    return responses.successResponse(await updateSurvey({ ...inputValidation.data, id: params.surveyId }));
  } catch (error) {
    return handleErrorResponse(error);
  }
};
