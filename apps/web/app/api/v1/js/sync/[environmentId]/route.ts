import { getPublicUpdatedState, getUpdatedState } from "@/app/api/v1/js/lib/sync";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { getOrCreatePersonByUserId } from "@formbricks/lib/person/service";
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

    // validate using zod
    const environmentIdValidation = ZJsPublicSyncInput.safeParse({
      environmentId: params.environmentId,
      personId: searchParams.get("personId"),
      jsVersion: searchParams.get("jsVersion"),
      userId: searchParams.get("userId"),
    });

    if (!environmentIdValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(environmentIdValidation.error),
        true
      );
    }

    const { environmentId, personId, jsVersion, userId } = environmentIdValidation.data;

    // if userId is provided, this is an identified user but we need to get the personId from the userId

    if (userId) {
      const person = await getOrCreatePersonByUserId(userId, environmentId);

      if (!person) {
        return responses.badRequestResponse("Fields are missing or incorrectly formatted");
      }

      const state = await getUpdatedState(environmentId, person.id, jsVersion ?? undefined);

      return responses.successResponse({ ...state }, true);
    }

    // if personId is provided, this is an identfied user

    if (personId) {
      // validate using zod
      const inputValidation = ZJsSyncInput.safeParse({
        environmentId,
        personId,
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
        jsVersion: jsVersionInput,
      } = inputValidation.data;

      const state = await getUpdatedState(environmentIdInput, personIdInput, jsVersionInput);

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
