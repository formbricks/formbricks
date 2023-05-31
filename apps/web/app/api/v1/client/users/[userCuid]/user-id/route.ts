/*
THIS FILE IS WORK IN PROGRESS
PLEASE DO NOT USE IT YET
*/

import { getSettings } from "@/lib/api/clientSettings";
import { responses } from "@/lib/api/response";
import { prisma } from "@formbricks/database";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(request: Request, params: { userCuid: string }): Promise<NextResponse> {
  const { userCuid } = params;
  const { userId, sessionId } = await request.json();

  if (!userId) {
    return responses.missingFieldResponse("userId", true);
  }

  if (!sessionId) {
    return responses.missingFieldResponse("sessionId", true);
  }

  let returnedUser;

  // find person
  const person = await prisma.person.findUnique({
    where: {
      id: userCuid,
    },
    select: {
      id: true,
      environmentId: true,
    },
  });

  if (!person) {
    return responses.notFoundResponse("User", userCuid, true);
  }

  const environmentId = person.environmentId;

  // check if person with this userId already exists
  const existingPerson = await prisma.person.findFirst({
    where: {
      environmentId,
      attributes: {
        some: {
          attributeClass: {
            name: "userId",
          },
          value: userId,
        },
      },
    },
    select: {
      id: true,
      environmentId: true,
      attributes: {
        select: {
          id: true,
          value: true,
          attributeClass: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });
  // if person exists, reconnect ression and delete old user
  if (existingPerson) {
    // reconnect session to new person
    await prisma.session.update({
      where: {
        id: sessionId,
      },
      data: {
        person: {
          connect: {
            id: existingPerson.id,
          },
        },
      },
    });

    // delete old person
    await prisma.person.delete({
      where: {
        id: userCuid,
      },
    });
    returnedUser = existingPerson;
  } else {
    // update person
    returnedUser = await prisma.person.update({
      where: {
        id: userCuid,
      },
      data: {
        attributes: {
          create: {
            value: userId,
            attributeClass: {
              connect: {
                name_environmentId: {
                  name: "userId",
                  environmentId,
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        environmentId: true,
        attributes: {
          select: {
            id: true,
            value: true,
            attributeClass: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  const { surveys, noCodeEvents, brandColor } = await getSettings(environmentId, returnedUser.id);

  return responses.successResponse({ user: returnedUser, surveys, noCodeEvents, brandColor }, true);
}
