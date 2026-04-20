import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { responses } from "@/app/lib/api/response";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getResponseIdByDisplayId } from "./lib/response";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const GET = withV1ApiWrapper({
  handler: async ({
    req,
    props,
  }: THandlerParams<{ params: Promise<{ environmentId: string; displayId: string }> }>) => {
    const params = await props.params;

    try {
      const response = await getResponseIdByDisplayId(params.environmentId, params.displayId);

      return {
        response: responses.successResponse(response, true),
      };
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        return {
          response: responses.notFoundResponse("Display", params.displayId, true),
        };
      }

      logger.error(
        { error, url: req.url, environmentId: params.environmentId, displayId: params.displayId },
        "Error in GET /api/v1/client/[environmentId]/displays/[displayId]/response"
      );
      return {
        response: responses.internalServerErrorResponse("Something went wrong. Please try again."),
      };
    }
  },
});
