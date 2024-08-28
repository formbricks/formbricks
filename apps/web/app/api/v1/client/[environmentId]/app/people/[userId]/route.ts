import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextRequest, userAgent } from "next/server";
import { ZJsPersonIdentifyInput } from "@formbricks/types/js";
import { getPersonState } from "./lib/personState";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const GET = async (
  request: NextRequest,
  { params }: { params: { environmentId: string; userId: string } }
): Promise<Response> => {
  try {
    const { environmentId, userId } = params;

    // Validate input
    const syncInputValidation = ZJsPersonIdentifyInput.safeParse({
      environmentId,
      userId,
    });
    if (!syncInputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(syncInputValidation.error),
        true
      );
    }

    const { device } = userAgent(request);
    const deviceType = device ? "phone" : "desktop";

    try {
      const personState = await getPersonState({
        environmentId,
        userId,
        device: deviceType,
      });

      return responses.successResponse(
        personState,
        true,
        "public, s-maxage=600, max-age=840, stale-while-revalidate=600, stale-if-error=600"
      );
    } catch (err) {
      return responses.internalServerErrorResponse(
        err.message ?? "Unable to fetch person state",
        true,
        "public, s-maxage=600, max-age=840, stale-while-revalidate=600, stale-if-error=600"
      );
    }
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(`Unable to complete response: ${error.message}`, true);
  }
};
