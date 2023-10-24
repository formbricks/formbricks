import { responses } from "@/app/lib/api/response";
import { updateDisplay } from "@formbricks/lib/display/service";
import { TDisplayInput, ZDisplayUpdate } from "@formbricks/types/displays";
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
  const displayInput: TDisplayInput = await request.json();
  const inputValidation = ZDisplayUpdate.safeParse(displayInput);

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
    console.error(error.message);
    return responses.internalServerErrorResponse(error.message, true);
  }
}
