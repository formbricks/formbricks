import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { updateDisplayLegacy } from "@formbricks/lib/display/service";
import { TDisplayLegacyCreateInput, ZDisplayLegacyCreateInput } from "@formbricks/types/displays";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function PUT(
  request: Request,
  { params }: { params: { displayId: string } }
): Promise<NextResponse> {
  const { displayId } = params;
  if (!displayId) {
    return responses.badRequestResponse("Missing displayId", undefined, true);
  }
  const displayInput: TDisplayLegacyCreateInput = await request.json();
  const inputValidation = ZDisplayLegacyCreateInput.safeParse(displayInput);

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }
  try {
    const display = await updateDisplayLegacy(displayId, inputValidation.data);
    return responses.successResponse(display, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(error.message, true);
  }
}
