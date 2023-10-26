import { getPublicUpdatedState } from "@/app/api/v1/js/sync/public/lib/sync";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { ZJsPublicSyncInput } from "@formbricks/types/js";
import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // const jsonInput = await req.json();
    const searchParams = req.nextUrl.searchParams;
    const environmentIdParam = searchParams.get("environmentId");

    // validate using zod
    const inputValidation = ZJsPublicSyncInput.safeParse({ environmentId: environmentIdParam });

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const { environmentId } = inputValidation.data;

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
