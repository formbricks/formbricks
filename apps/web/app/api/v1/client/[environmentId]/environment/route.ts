import { getEnvironmentState } from "@/app/api/v1/client/[environmentId]/environment/lib/environmentState";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextRequest } from "next/server";
import { environmentCache } from "@formbricks/lib/environment/cache";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZJsSyncInput } from "@formbricks/types/js";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const GET = async (
  _: NextRequest,
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

      if (environmentState.revalidateEnvironment) {
        environmentCache.revalidate({
          id: inputValidation.data.environmentId,
          projectId: environmentState.state.project.id,
        });
      }

      return responses.successResponse(
        environmentState.state,
        true,
        "public, s-maxage=600, max-age=840, stale-while-revalidate=600, stale-if-error=600"
      );
    } catch (err) {
      if (err instanceof ResourceNotFoundError) {
        return responses.notFoundResponse(err.resourceType, err.resourceId);
      }

      console.error(err);
      return responses.internalServerErrorResponse(err.message, true);
    }
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse("Unable to handle the request: " + error.message, true);
  }
};
