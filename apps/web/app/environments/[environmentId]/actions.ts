"use server";

import { PrismaClient, Team } from "@prisma/client";

const prisma = new PrismaClient();

interface CreateTeamData {
  name: string;
  stripeCustomerId?: string;
  ownerUserId: string;
}

export async function createTeamInDb(data: CreateTeamData): Promise<Team> {
  const newTeam = await prisma.team.create({
    data: {
      name: data.name,
      memberships: {
        create: {
          user: { connect: { id: data.ownerUserId } },
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
