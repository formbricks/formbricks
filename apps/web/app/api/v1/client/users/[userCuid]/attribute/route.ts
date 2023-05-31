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
  const { key, value } = await request.json();

  if (!key) {
    return responses.missingFieldResponse("key", true);
  }

  if (!value) {
    return responses.missingFieldResponse("value", true);
  }

  const currentPerson = await prisma.person.findUnique({
    where: {
      id: userCuid,
    },
    select: {
      id: true,
      environmentId: true,
      attributes: {
        select: {
          id: true,
          attributeClass: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!currentPerson) {
    return responses.notFoundResponse("User", userCuid, true);
  }

  const environmentId = currentPerson.environmentId;

  // find attribute class
  let attributeClass = await prisma.attributeClass.findUnique({
    where: {
      name_environmentId: {
        name: key,
        environmentId,
      },
    },
    select: {
      id: true,
    },
  });

  // create new attribute class if not found
  if (attributeClass === null) {
    attributeClass = await prisma.attributeClass.create({
      data: {
        name: key,
        type: "code",
        environment: {
          connect: {
            id: environmentId,
          },
        },
      },
      select: {
        id: true,
      },
    });
  }

  // upsert attribute (update or create)
  const attribute = await prisma.attribute.upsert({
    where: {
      attributeClassId_personId: {
        attributeClassId: attributeClass.id,
        personId: userCuid,
      },
    },
    update: {
      value,
    },
    create: {
      attributeClass: {
        connect: {
          id: attributeClass.id,
        },
      },
      person: {
        connect: {
          id: userCuid,
        },
      },
      value,
    },
    select: {
      person: {
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
      },
    },
  });

  const user = attribute.person;

  const { surveys, noCodeEvents, brandColor } = await getSettings(environmentId, user.id);

  return responses.successResponse({ user, surveys, noCodeEvents, brandColor }, true);
}
