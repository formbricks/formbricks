import { responses } from "@/app/lib/api/response";
import { NextResponse } from "next/server";

import { markDisplayRespondedLegacy } from "@formbricks/lib/display/service";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(_: Request, { params }: { params: { displayId: string } }): Promise<NextResponse> {
  const { displayId } = params;

  if (!displayId) {
    return responses.badRequestResponse("Missing displayId");
  }

  try {
    await markDisplayRespondedLegacy(displayId);
    return responses.successResponse({}, true);
  } catch (error) {
    return responses.internalServerErrorResponse(error.message);
  }
}
