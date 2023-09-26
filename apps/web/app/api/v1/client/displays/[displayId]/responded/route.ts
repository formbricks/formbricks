import { responses } from "@/lib/api/response";
import { markDisplayResponded, updateDisplay } from "@formbricks/lib/services/displays";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(_: Request, { params }: { params: { displayId: string } }): Promise<NextResponse> {
  const { displayId } = params;

  if (!displayId) {
    return responses.badRequestResponse("Missing displayId");
  }

  try {
    const display = await markDisplayResponded(displayId);
    return responses.successResponse(
      {
        ...display,
        createdAt: display.createdAt.toISOString(),
        updatedAt: display.updatedAt.toISOString(),
      },
      true
    );
  } catch (error) {
    return responses.internalServerErrorResponse(error.message);
  }
}
export async function PUT(
  request: Request,
  { params }: { params: { displayId: string } }
): Promise<NextResponse> {
  const { displayId } = params;

  if (!displayId) {
    return responses.badRequestResponse("Missing displayId");
  }
  const displayUpdate = await request.json();

  try {
    const display = await updateDisplay(displayId, displayUpdate);
    return responses.successResponse(display);
  } catch (error) {
    return responses.internalServerErrorResponse(error.message);
  }
}
