import { getEnvironmentState } from "@/app/api/v1/client/[environmentId]/app/environment/lib/environmentState";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextRequest } from "next/server";
import { ZJsSyncInput } from "@formbricks/types/js";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const GET = async (
  _: NextRequest,
  {
    params,
  }: {
    params: {
      environmentId: string;
    };
  }
): Promise<Response> => {
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
      return responses.successResponse(environmentState, true);
    } catch (err) {
      return responses.internalServerErrorResponse(err.message, true);
    }
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse("Unable to handle the request: " + error.message, true);
  }
};
