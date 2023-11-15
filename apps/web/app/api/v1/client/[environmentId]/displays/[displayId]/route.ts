import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { updateDisplay } from "@formbricks/lib/display/service";
import { ZDisplayUpdateInput } from "@formbricks/types/displays";
import { NextResponse } from "next/server";

interface Context {
  params: {
    displayId: string;
    environmentId: string;
  };
}

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function PUT(request: Request, context: Context): Promise<NextResponse> {
  const { displayId } = context.params;
  const jsonInput = await request.json();
  const inputValidation = ZDisplayUpdateInput.safeParse({
    ...jsonInput,
  });

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
    console.error(error);
    return responses.internalServerErrorResponse(error.message, true);
  }
}
