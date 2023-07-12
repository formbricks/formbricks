import { responses } from "@/lib/api/response";
import { transformErrorToDetails } from "@/lib/api/validator";
import { prisma } from "@formbricks/database";
import { ZJsActionInput } from "@formbricks/types/v1/js";
import { EventType } from "@prisma/client";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(req: Request): Promise<NextResponse> {
  const jsonInput = await req.json();

  // validate using zod
  const inputValidation = ZJsActionInput.safeParse(jsonInput);

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  const { environmentId, sessionId, name, properties } = inputValidation.data;

  let eventType: EventType = EventType.code;
  if (name === "Exit Intent (Desktop)" || name === "50% Scroll") {
    eventType = EventType.automatic;
  }

  await prisma.event.create({
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
              name,
              environmentId,
            },
          },
          create: {
            name,
            type: eventType,
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

  return responses.successResponse({}, true);
}
