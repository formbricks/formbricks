import { responses } from "@/lib/api/response";
import { updateDisplay } from "@formbricks/lib/display/service";
import { TDisplayInput, ZDisplayUpdate } from "@formbricks/types/v1/displays";
import { NextResponse } from "next/server";
import { transformErrorToDetails } from "@/lib/api/validator";

export async function PUT(
  request: Request,
  { params }: { params: { displayId: string } }
): Promise<NextResponse> {
  const { displayId } = params;
  if (!displayId) {
    return responses.badRequestResponse("Missing displayId");
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
    return responses.successResponse(display);
  } catch (error) {
    return responses.internalServerErrorResponse(error.message);
  }
}
