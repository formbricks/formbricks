import { logger } from "@formbricks/logger";
import { ZDisplayCreateInput } from "@formbricks/types/displays";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { RequestBodyTooLargeError, parseJsonBodyWithLimit } from "@/app/lib/api/request-body";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { resolveClientApiIds } from "@/lib/utils/resolve-client-id";
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
  handler: async ({ req, props }: THandlerParams<{ params: Promise<{ workspaceId: string }> }>) => {
    const params = await props.params;

    // Resolve: accepts either an environmentId (old SDK) or a workspaceId (new SDK)
    const resolved = await resolveClientApiIds(params.workspaceId);
    if (!resolved) {
      return {
        response: responses.notFoundResponse("Workspace", params.workspaceId),
      };
    }
    const { workspaceId } = resolved;

    let jsonInput;
    try {
      jsonInput = await parseJsonBodyWithLimit<Record<string, unknown>>(req);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return {
          response: responses.payloadTooLargeResponse("Payload Too Large", { error: error.message }, true),
        };
      }

      throw error;
    }

    const inputValidation = ZDisplayCreateInput.safeParse({
      ...jsonInput,
      workspaceId,
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
      const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
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
        logger.error({ error, url: req.url }, "Error in POST /api/v1/client/[workspaceId]/displays");
        return {
          response: responses.internalServerErrorResponse("Something went wrong. Please try again."),
        };
      }
    }
  },
});
