import { getApiKeyDataOrFail, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { duplicateSurvey } from "@formbricks/lib/survey/service";
import { getOrCreateAdminUserForOrganization } from "@formbricks/lib/user/service";
import { AuthenticationError, ValidationError, ValidationErrorWithDetails } from "@formbricks/types/errors";

export const POST = async (
  request: Request,
  { params }: { params: { surveyId: string } }
): Promise<Response> => {
  try {
    const apiKeyData = await getApiKeyDataOrFail(request);
    const organizationId = apiKeyData.environment.product.organizationId;

    const userData = {
      email: `${apiKeyData.hashedKey}@apiKey`,
      name: `ApiKey user [${apiKeyData.hashedKey}]`,
    };

    const user = await getOrCreateAdminUserForOrganization(userData, organizationId);
    if (!user) {
      return responses.internalServerErrorResponse(
        `Failed to get or create admin user for organization with ID: ${organizationId}. ` +
          `Input data: ${JSON.stringify(userData)}.`
      );
    }

    const newSurvey = await duplicateSurvey(apiKeyData.environmentId, params.surveyId, user.id);

    if (newSurvey) {
      return responses.successResponse(newSurvey);
    } else {
      return responses.internalServerErrorResponse("Failed to duplicate survey");
    }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return responses.notAuthenticatedResponse();
    }
    if (error instanceof ValidationErrorWithDetails) {
      return responses.badRequestResponse(error.message, error.details, true);
    }

    if (error instanceof ValidationError) {
      return responses.badRequestResponse(error.message, undefined, true);
    }
    return handleErrorResponse(error);
  }
};
