import { createSession } from "@/lib/api/clientSession";
import { getSettings } from "@/lib/api/clientSettings";
import { responses } from "@/lib/api/response";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(request: Request): Promise<NextResponse> {
  const { personId, environmentId } = await request.json();

  if (!personId) {
    return responses.missingFieldResponse("sessionId", true);
  }

  if (!environmentId) {
    return responses.missingFieldResponse("environmentId", true);
  }

  const session = await createSession(personId);
  const { surveys, noCodeActions, brandColor } = await getSettings(environmentId, personId);

  captureTelemetry("session created");

  return responses.successResponse({ session, surveys, noCodeActions, brandColor }, true);
}
