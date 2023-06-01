/*
THIS FILE IS WORK IN PROGRESS
PLEASE DO NOT USE IT YET
*/

import { responses } from "@/lib/api/response";
import { prisma } from "@formbricks/database";
import { capturePosthogEvent } from "@formbricks/lib/posthogServer";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(request: Request): Promise<NextResponse> {
  const { surveyId, personId, environmentId } = await request.json();

  if (!surveyId) {
    return responses.missingFieldResponse("surveyId", true);
  }

  if (!environmentId) {
    return responses.missingFieldResponse("environmentId", true);
  }

  // get teamId from environment
  const environment = await prisma.environment.findUnique({
    where: {
      id: environmentId,
    },
    select: {
      product: {
        select: {
          team: {
            select: {
              id: true,
              memberships: {
                select: {
                  userId: true,
                  role: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!environment) {
    return responses.notFoundResponse("Environment", environmentId, true);
  }

  const teamId = environment.product.team.id;
  // find team owner
  const teamOwnerId = environment.product.team.memberships.find((m) => m.role === "owner")?.userId;

  const createBody: any = {
    select: {
      id: true,
    },
    data: {
      status: "seen",
      survey: {
        connect: {
          id: surveyId,
        },
      },
    },
  };

  if (personId) {
    createBody.data.person = {
      connect: {
        id: personId,
      },
    };
  }

  // create new display
  const display = await prisma.display.create(createBody);

  if (teamOwnerId) {
    await capturePosthogEvent(teamOwnerId, "display created", teamId, {
      surveyId,
    });
  } else {
    console.warn("Posthog capture not possible. No team owner found");
  }

  return responses.successResponse(
    {
      ...display,
      createdAt: display.createdAt.toISOString(),
      updatedAt: display.updatedAt.toISOString(),
    },
    true
  );
}
