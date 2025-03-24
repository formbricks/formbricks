import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { getMultiLanguagePermission } from "@/modules/ee/license-check/lib/utils";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { createSurvey, getSurveys } from "@formbricks/lib/survey/service";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { TSurvey, ZSurveyCreateInput } from "@formbricks/types/surveys/types";

export const GET = async (request: Request) => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const searchParams = new URL(request.url).searchParams;
    const limit = searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined;
    const offset = searchParams.has("offset") ? Number(searchParams.get("offset")) : undefined;

    const environmentIds = authentication.environmentPermissions.map(
      (permission) => permission.environmentId
    );

    const allSurveys: TSurvey[] = [];
    for (const environmentId of environmentIds) {
      const surveys = await getSurveys(environmentId, limit, offset);
      allSurveys.push(...surveys);
    }

    return responses.successResponse(allSurveys);
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

    let surveyInput;
    try {
      surveyInput = await request.json();
    } catch (error) {
      logger.error({ error, url: request.url }, "Error parsing JSON");
      return responses.badRequestResponse("Malformed JSON input, please check your request body");
    }

    const inputValidation = ZSurveyCreateInput.safeParse(surveyInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const environmentId = inputValidation.data.environmentId;

    const organization = await getOrganizationByEnvironmentId(environmentId);
    if (!organization) {
      return responses.notFoundResponse("Organization", null);
    }

    if (!hasPermission(authentication.environmentPermissions, environmentId, "POST")) {
      return responses.unauthorizedResponse();
    }

    const surveyData = { ...inputValidation.data, environmentId };

    if (surveyData.followUps?.length) {
      const isSurveyFollowUpsEnabled = await getSurveyFollowUpsPermission(organization.billing.plan);
      if (!isSurveyFollowUpsEnabled) {
        return responses.forbiddenResponse("Survey follow ups are not enabled allowed for this organization");
      }
    }

    if (surveyData.languages && surveyData.languages.length) {
      const isMultiLanguageEnabled = await getMultiLanguagePermission(organization.billing.plan);
      if (!isMultiLanguageEnabled) {
        return responses.forbiddenResponse("Multi language is not enabled for this organization");
      }
    }

    const survey = await createSurvey(environmentId, surveyData);
    return responses.successResponse(survey);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};
