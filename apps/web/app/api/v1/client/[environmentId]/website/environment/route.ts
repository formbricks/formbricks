import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextRequest } from "next/server";
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

      return responses.successResponse(
        environmentState,
        true,
        "public, s-maxage=600, max-age=840, stale-while-revalidate=600, stale-if-error=600"
      );
    } catch (err) {
      return responses.internalServerErrorResponse(err.message ?? "Unable to complete response", true);
    }
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(`Unable to complete response: ${error.message}`, true);
  }
};
