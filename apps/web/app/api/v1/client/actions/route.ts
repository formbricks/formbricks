import { responses } from "@/lib/api/response";
import { prisma } from "@formbricks/database";
import { ActionResponse } from "@formbricks/types/api/client";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(request: Request): Promise<NextResponse> {
  const { sessionId, environmentId, eventName, properties } = await request.json();

  if (!sessionId) {
    return responses.missingFieldResponse("sessionId", true);
  }

  if (!environmentId) {
    return responses.missingFieldResponse("environmentId", true);
  }

  if (!eventName) {
    return responses.missingFieldResponse("eventName", true);
  }

  const action = await prisma.event.create({
    data: {
      properties,
      session: {
        connect: {
          id: sessionId,
        },
      },
      eventClass: {
        connectOrCreate: {
          where: {
            name_environmentId: {
              name: eventName,
              environmentId,
            },
          },
          create: {
            name: eventName,
            type: "code",
            environment: {
              connect: {
                id: environmentId,
              },
            },
          },
        },
      },
    },
    select: {
      id: true,
    },
  });

  return responses.successResponse(action as ActionResponse, true);
}
