import { responses } from "@/lib/api/response";
import { markDisplayResponded } from "@formbricks/lib/services/displays";
import { TDisplay } from "@formbricks/types/v1/displays";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(_: Request, { params }: { params: { displayId: string } }): Promise<NextResponse> {
  const { displayId } = params;

  if (!displayId) {
    return responses.badRequestResponse("Missing displayId");
  }

  let display: TDisplay;

  try {
    display = await markDisplayResponded(displayId);
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
