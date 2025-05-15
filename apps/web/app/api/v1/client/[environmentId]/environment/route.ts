import { getEnvironmentState } from "@/app/api/v1/client/[environmentId]/environment/lib/environmentState";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { environmentCache } from "@/lib/environment/cache";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZJsSyncInput } from "@formbricks/types/js";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const GET = async (
  request: NextRequest,
  props: {
    params: Promise<{
      environmentId: string;
    }>;
  }
): Promise<Response> => {
  const params = await props.params;

  try {
    // validate using zod
    const inputValidation = ZJsSyncInput.safeParse({
      environmentId: params.environmentId,
    });

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    try {
      const environmentState = await getEnvironmentState(params.environmentId);
      const { data, revalidateEnvironment } = environmentState;

      if (revalidateEnvironment) {
        environmentCache.revalidate({
          id: inputValidation.data.environmentId,
          projectId: data.project.id,
        });
      }

      return responses.successResponse(
        {
          data,
          expiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 minutes
        },
        true,
        "public, s-maxage=600, max-age=840, stale-while-revalidate=600, stale-if-error=600"
      );
    } catch (err) {
      if (err instanceof ResourceNotFoundError) {
        return responses.notFoundResponse(err.resourceType, err.resourceId);
      }

      logger.error(
        { error: err, url: request.url },
        "Error in GET /api/v1/client/[environmentId]/environment"
      );
      return responses.internalServerErrorResponse(err.message, true);
    }
  } catch (error) {
    logger.error({ error, url: request.url }, "Error in GET /api/v1/client/[environmentId]/environment");
    return responses.internalServerErrorResponse("Unable to handle the request: " + error.message, true);
  }
};
