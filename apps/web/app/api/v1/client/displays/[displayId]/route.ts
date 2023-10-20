import { responses } from "@/app/lib/api/response";
import { updateDisplay } from "@formbricks/lib/display/service";
import { TDisplayCreateInput, ZDisplayUpdateInput } from "@formbricks/types/displays";
import { NextResponse } from "next/server";
import { transformErrorToDetails } from "@/app/lib/api/validator";

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
  const displayInput: TDisplayCreateInput = await request.json();
  const inputValidation = ZDisplayUpdateInput.safeParse(displayInput);

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }
  try {
    const display = await updateDisplay(displayId, inputValidation.data);
    return responses.successResponse(display, true);
  } catch (error) {
    return responses.internalServerErrorResponse(error.message, true);
  }
}
