"use server";

import { prisma } from "@formbricks/database";
import { Team } from "@prisma/client";

export async function createTeam(teamName: string, ownerUserId: string): Promise<Team> {
  const newTeam = await prisma.team.create({
    data: {
      name: teamName,
      memberships: {
        create: {
          user: { connect: { id: ownerUserId } },
          role: "owner",
          accepted: true,
        },
      },
      products: {
        create: [
          {
            name: "My Product",
            environments: {
              create: [
                {
                  type: "production",
                  eventClasses: {
                    create: [
                      {
                        name: "New Session",
                        description: "Gets fired when a new session is created",
                        type: "automatic",
                      },
                    ],
                  },
                  attributeClasses: {
                    create: [
                      {
                        name: "userId",
                        description: "The internal ID of the person",
                        type: "automatic",
                      },
                      {
                        name: "email",
                        description: "The email of the person",
                        type: "automatic",
                      },
                    ],
                  },
                },
                {
                  type: "development",
                  eventClasses: {
                    create: [
                      {
                        name: "New Session",
                        description: "Gets fired when a new session is created",
                        type: "automatic",
                      },
                    ],
                  },
                  attributeClasses: {
                    create: [
                      {
                        name: "userId",
                        description: "The internal ID of the person",
                        type: "automatic",
                      },
                      {
                        name: "email",
                        description: "The email of the person",
                        type: "automatic",
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      memberships: true,
    },
  });

  return newTeam;
}
