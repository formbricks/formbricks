/*
THIS FILE IS WORK IN PROGRESS
PLEASE DO NOT USE IT YET
*/

import { createPerson } from "@/lib/api/clientPerson";
import { createSession } from "@/lib/api/clientSession";
import { getSettings } from "@/lib/api/clientSettings";
import { responses } from "@/lib/api/response";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(request: Request): Promise<NextResponse> {
  const { environmentId } = await request.json();

  if (!environmentId) {
    return responses.missingFieldResponse("environmentId", true);
  }

  const user = await createPerson(environmentId);
  const session = await createSession(user.id);
  const { surveys, noCodeEvents, brandColor } = await getSettings(environmentId, user.id);

  return responses.successResponse({ user, session, surveys, noCodeEvents, brandColor }, true);
}
