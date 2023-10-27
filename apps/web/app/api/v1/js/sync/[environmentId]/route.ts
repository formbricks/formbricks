import { getPublicUpdatedState, getUpdatedState } from "@/app/api/v1/js/sync/[environmentId]/lib/sync";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { ZJsPublicSyncInput, ZJsSyncInput } from "@formbricks/types/js";
import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { environmentId: string } }
): Promise<NextResponse> {
  try {
    const searchParams = req.nextUrl.searchParams;

    const { environmentId: environmentIdParam } = params;

    // validate using zod
    const environmentIdValidation = ZJsPublicSyncInput.safeParse({
      environmentId: environmentIdParam,
      personId: searchParams.get("personId"),
      sessionId: searchParams.get("sessionId"),
      jsVersion: searchParams.get("jsVersion"),
    });

    if (!environmentIdValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(environmentIdValidation.error),
        true
      );
    }

    const { environmentId, personId, jsVersion, sessionId } = environmentIdValidation.data;

    // if personId is provided, this is an identfied user

    if (personId) {
      // validate using zod
      const inputValidation = ZJsSyncInput.safeParse({
        environmentId,
        personId,
        sessionId,
        jsVersion,
      });

      if (!inputValidation.success) {
        return responses.badRequestResponse(
          "Fields are missing or incorrectly formatted",
          transformErrorToDetails(inputValidation.error),
          true
        );
      }

      const {
        environmentId: environmentIdInput,
        personId: personIdInput,
        sessionId: sessionIdInput,
        jsVersion: jsVersionInput,
      } = inputValidation.data;

      const state = await getUpdatedState(environmentIdInput, personIdInput, sessionIdInput, jsVersionInput);

      return responses.successResponse({ ...state }, true);
    }

    const state = await getPublicUpdatedState(environmentId);

    return responses.successResponse({ ...state }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(
      "Unable to complete response. See server logs for details.",
      true
    );
  }
}
