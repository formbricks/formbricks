import { getUpdatedState } from "@/app/api/v1/js/sync/lib/sync";
import { responses } from "@/lib/api/response";
import { transformErrorToDetails } from "@/lib/api/validator";
import { ZJsSyncInput } from "@formbricks/types/v1/js";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { deviceType } from "@formbricks/lib/utils/headers";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const headersList = headers();
    const userAgent = headersList.get("user-agent");
    const device = deviceType(userAgent ?? "");

    const jsonInput = await req.json();

    // validate using zod
    const inputValidation = ZJsSyncInput.safeParse(jsonInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const { environmentId, personId, sessionId } = inputValidation.data;

    const state = await getUpdatedState(
      environmentId,
      device,
      personId,
      sessionId,
      inputValidation.data.jsVersion
    );

    return responses.successResponse({ ...state }, true);
  } catch (error) {
    console.error(error.message);
    return responses.internalServerErrorResponse(
      "Unable to complete response. See server logs for details.",
      true
    );
  }
}
