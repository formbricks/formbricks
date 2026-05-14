import { logger } from "@formbricks/logger";
import { ZDisplayCreateInput } from "@formbricks/types/displays";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { createDisplay } from "./lib/display";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse(
    {},
    true,
    // Cache CORS preflight responses for 1 hour (conservative approach)
    // Balances performance gains with flexibility for CORS policy changes
    "public, s-maxage=3600, max-age=3600"
  );
};

export const POST = withV1ApiWrapper({
  handler: async ({ req, props }: THandlerParams<{ params: Promise<{ environmentId: string }> }>) => {
    const params = await props.params;
    const jsonInput = await req.json();
    const inputValidation = ZDisplayCreateInput.safeParse({
      ...jsonInput,
      environmentId: params.environmentId,
    });

    if (!inputValidation.success) {
      return {
        response: responses.badRequestResponse(
          "Fields are missing or incorrectly formatted",
          transformErrorToDetails(inputValidation.error),
          true
        ),
      };
    }

    if (inputValidation.data.userId) {
      const organizationId = await getOrganizationIdFromEnvironmentId(params.environmentId);
      const isContactsEnabled = await getIsContactsEnabled(organizationId);
      if (!isContactsEnabled) {
        return {
          response: responses.forbiddenResponse(
            "User identification is only available for enterprise users.",
            true
          ),
        };
      }
    }

    try {
      const response = await createDisplay(inputValidation.data);

      return {
        response: responses.successResponse(response, true),
      };
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        return {
          response: responses.notFoundResponse("Survey", inputValidation.data.surveyId),
        };
      } else if (error instanceof InvalidInputError) {
        return {
          response: responses.forbiddenResponse(error.message, true, {
            surveyId: inputValidation.data.surveyId,
          }),
        };
      } else {
        logger.error({ error, url: req.url }, "Error in POST /api/v1/client/[environmentId]/displays");
        return {
          response: responses.internalServerErrorResponse("Something went wrong. Please try again."),
        };
      }
    }
  },
});
