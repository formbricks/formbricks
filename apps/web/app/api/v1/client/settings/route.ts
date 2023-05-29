/*
THIS FILE IS WORK IN PROGRESS
PLEASE DO NOT USE IT YET
*/

import { getSettings } from "@/lib/api/clientSettings";
import { responses } from "@/lib/api/response";
import { prisma } from "@formbricks/database";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(request: Request): Promise<NextResponse> {
  const { userCuid } = await request.json();

  if (!userCuid) {
    return responses.missingFieldResponse("userCuid", true);
  }

  // get user
  const user = await prisma.person.findUnique({
    where: {
      id: userCuid,
    },
    select: {
      id: true,
      environmentId: true,
    },
  });

  if (!user) {
    return responses.notFoundResponse("User", userCuid, true);
  }

  const { surveys, noCodeEvents, brandColor } = await getSettings(user.environmentId, user.id);

  captureTelemetry("session created");

  return responses.successResponse({ surveys, noCodeEvents, brandColor }, true);
}
