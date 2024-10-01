import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextRequest } from "next/server";
import { environmentCache } from "@formbricks/lib/environment/cache";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZJsSyncInput } from "@formbricks/types/js";
import { getEnvironmentState } from "./lib/environmentState";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const GET = async (
  _: NextRequest,
  { params }: { params: { environmentId: string } }
): Promise<Response> => {
  try {
    const syncInputValidation = ZJsSyncInput.safeParse({
      environmentId: params.environmentId,
    });

    if (!syncInputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(syncInputValidation.error),
        true
      );
    }

    const { environmentId } = syncInputValidation.data;

    try {
      const environmentState = await getEnvironmentState(environmentId);

      if (environmentState.revalidateEnvironment) {
        environmentCache.revalidate({
          id: syncInputValidation.data.environmentId,
          productId: environmentState.state.product.id,
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
      return responses.internalServerErrorResponse(err.message ?? "Unable to complete response", true);
    }
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(`Unable to complete response: ${error.message}`, true);
  }
};
