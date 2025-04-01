import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { createSurvey, getSurveys } from "@formbricks/lib/survey/service";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { ZSurveyCreateInput } from "@formbricks/types/surveys/types";

export const GET = async (request: Request) => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const searchParams = new URL(request.url).searchParams;
    const limit = searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined;
    const offset = searchParams.has("offset") ? Number(searchParams.get("offset")) : undefined;

    const surveys = await getSurveys(authentication.environmentId!, limit, offset);
    return responses.successResponse(surveys);
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

    const organization = await getOrganizationByEnvironmentId(authentication.environmentId);
    if (!organization) {
      return responses.notFoundResponse("Organization", null);
    }

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

    const environmentId = authentication.environmentId;
    const surveyData = { ...inputValidation.data, environmentId: undefined };

    if (surveyData.followUps?.length) {
      const isSurveyFollowUpsEnabled = await getSurveyFollowUpsPermission(organization.billing.plan);
      if (!isSurveyFollowUpsEnabled) {
        return responses.forbiddenResponse("Survey follow ups are not enabled allowed for this organization");
      }
    }

    if (surveyData.languages && surveyData.languages.length) {
      const isMultiLanguageEnabled = false;
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
