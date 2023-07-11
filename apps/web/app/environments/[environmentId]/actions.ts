"use server";

import { prisma } from "@formbricks/database";
import { Team } from "@prisma/client";
import { templates } from "./surveys/templates/templates";

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
                      {
                        name: "Exit Intent (Desktop)",
                        description: "A user on Desktop leaves the website with the cursor.",
                        type: "automatic",
                      },
                      {
                        name: "50% Scroll",
                        description: "A user scrolled 50% of the current page",
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
      products: {
        include: {
          environments: true,
        },
      },
    },
  });

  // create some people
  const people: any[] = [];
  for (let i = 0; i < 5; i++) {
    const person = await prisma.person.create({
      data: {
        environment: { connect: { id: newTeam.products[0].environments[0].id } },
      },
    });
    people.push(person);
  }

  // use the first survey template
  const { category, description, preset, ...template } = templates[0];

  // add response data that will be added for every person
  const responseTemplates = [
    {
      finished: false,
      data: {},
      meta: {},
    },
  ];

  const responses: any = [];
  const displays: any = [];
  people.forEach((person) => {
    responseTemplates.forEach((template) => {
      responses.push({
        ...template,
        person: {
          connect: {
            id: person.id,
          },
        },
      });
      displays.push({
        person: {
          connect: {
            id: person.id,
          },
        },
        status: "responded",
      });
    });
  });

  await prisma.survey.create({
    data: {
      ...template,
      status: "inProgress",
      environment: { connect: { id: newTeam.products[0].environments[0].id } },
      questions: preset.questions as any,
      responses: {
        create: responses,
      },
      displays: {
        create: displays,
      },
    },
  });

  return newTeam;
}
