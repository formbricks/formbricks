import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TDisplayCreateInputV2,
  ZDisplayCreateInputV2,
} from "@/app/api/v2/client/[environmentId]/displays/types/display";
import { reportApiError } from "@/app/lib/api/api-error-reporter";
import { applyClientApiRateLimit } from "@/app/lib/api/client-rate-limit";
import { parseAndValidateJsonBody } from "@/app/lib/api/parse-and-validate-json-body";
import { responses } from "@/app/lib/api/response";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { createDisplay } from "./lib/display";

interface Context {
  params: Promise<{
    environmentId: string;
  }>;
}

type TValidatedDisplayInputResult = { displayInputData: TDisplayCreateInputV2 } | { response: Response };

const parseAndValidateDisplayInput = async (
  request: Request,
  environmentId: string
): Promise<TValidatedDisplayInputResult> => {
  const inputValidation = await parseAndValidateJsonBody({
    request,
    schema: ZDisplayCreateInputV2,
    buildInput: (jsonInput) => ({
      ...(jsonInput !== null && typeof jsonInput === "object" ? jsonInput : {}),
      environmentId,
    }),
    malformedJsonMessage: "Invalid JSON in request body",
  });

  if ("response" in inputValidation) {
    return inputValidation;
  }

  return { displayInputData: inputValidation.data };
};

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse(
    {},
    true,
    // Cache CORS preflight responses for 1 hour (conservative approach)
    // Balances performance gains with flexibility for CORS policy changes
    "public, s-maxage=3600, max-age=3600"
  );
};

export const POST = async (request: Request, context: Context): Promise<Response> => {
  const params = await context.params;
  const rateLimitResponse = await applyClientApiRateLimit({ request, environmentId: params.environmentId });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const validatedInput = await parseAndValidateDisplayInput(request, params.environmentId);

  if ("response" in validatedInput) {
    return validatedInput.response;
  }

  const { displayInputData } = validatedInput;

  try {
    if (displayInputData.contactId) {
      const organizationId = await getOrganizationIdFromEnvironmentId(params.environmentId);
      const isContactsEnabled = await getIsContactsEnabled(organizationId);
      if (!isContactsEnabled) {
        return responses.forbiddenResponse(
          "User identification is only available for enterprise users.",
          true
        );
      }
    }

    const response = await createDisplay(displayInputData);

    return responses.successResponse(response, true);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return responses.notFoundResponse("Survey", displayInputData.surveyId, true);
    }

    if (error instanceof InvalidInputError) {
      return responses.forbiddenResponse(error.message, true, {
        surveyId: displayInputData.surveyId,
      });
    }

    const response = responses.internalServerErrorResponse("Something went wrong. Please try again.", true);
    reportApiError({
      request,
      status: response.status,
      error,
    });
    return response;
  }
};
