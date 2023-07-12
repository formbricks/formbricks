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
              ],
            },
          },
          {
            name: "Demo Product",
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

  // call addDemoData with new team's id
  await addDemoData(newTeam.id);

  return newTeam;
}

export async function addDemoData(teamId: string): Promise<void> {
  // find the team
  const team = await prisma.team.findUnique({
    where: {
      id: teamId,
    },
    include: {
      products: {
        include: {
          environments: true,
        },
      },
    },
  });

  if (team === null) {
    throw new Error(`No team found with ID ${teamId}`);
  }

  // find the product
  const product = team.products.find((product) => product.name === "Demo Product");

  if (!product) {
    throw new Error(`No product named 'My Product' found in team ${teamId}`);
  }

  const prodEnvironment = product.environments.find((environment) => environment.type === "production");
  // add attributes to each environment of the product
  // dont add dev environment

  const updatedEnvironment = await prisma.environment.update({
    where: { id: prodEnvironment.id },
    data: {
      eventClasses: {
        create: [
          {
            name: "Created New Event",
            description: "Person created a new event",
            type: "code",
          },
          {
            name: "Updated Availability",
            description: "Person updated their availability",
            type: "code",
          },
          {
            name: "Received Booking Request",
            description: "Person received a booking request",
            type: "code",
          },
          {
            name: "Invited Team Member",
            description: "Person invited a team member",
            type: "noCode",
            noCodeConfig: { type: "innerHtml", innerHtml: { value: "Add Team Member" } },
          },
          {
            name: "Created New Workflow",
            description: "Person setup a new workflow",
            type: "noCode",
            noCodeConfig: { type: "innerHtml", innerHtml: { value: "Create Workflow" } },
          },
          {
            name: "Viewed Insight",
            description: "Person viewed the insights dashboard",
            type: "noCode",
            noCodeConfig: { type: "pageUrl", pageUrl: { rule: "contains", value: "insights" } },
          },
        ],
      },
      attributeClasses: {
        create: [
          {
            name: "Name",
            description: "Full Name of the Person",
            type: "code",
          },
          {
            name: "Role",
            description: "Current role of the person",
            type: "code",
          },
          {
            name: "Experience",
            description: "Level of experience of the person",
            type: "code",
          },
          {
            name: "Usage Frequency",
            description: "Frequency of product usage",
            type: "automatic",
          },
          {
            name: "Company Size",
            description: "Company size",
            type: "code",
          },
          {
            name: "Product Satisfaction Score",
            description: "Level of product satisfaction of the person",
            type: "automatic",
          },
          {
            name: "Recommendation Likelihood",
            description: "Likehood of recommending the product",
            type: "automatic",
          },
        ],
      },
    },
    include: {
      attributeClasses: true, // include attributeClasses
    },
  });

  // check if updatedEnvironment exists and it has attributeClasses
  if (!updatedEnvironment || !updatedEnvironment.attributeClasses) {
    throw new Error("Attribute classes could not be created");
  }

  // create some people
  const people: any[] = [];
  const attributeClasses = updatedEnvironment.attributeClasses;

  const names = [
    "Wei Zhu",
    "Akiko Yamada",
    "Elena Petrova",
    "Sophia Johnson",
    "Jorge Sanchez",
    "Fatima Al Zahra",
    "Ravi Kumar",
    "Maria Silva",
    "Amahle Dlamini",
    "Antonio García",
    "Leon Müller",
    "Chloe Lefevre",
    "Alessia Rossi",
    "Eva Svendsen",
    "Sara Eriksson",
    "Liam O'Brien",
    "Anastasia Sokolova",
    "Yara van der Heijden",
    "Zeynep Gündoğan",
    "Gabriella Mészáros",
  ];

  // A function to generate attribute values based on attribute class name and person's name
  function generateAttributeValue(attributeClassName: string, name: string, i: number): string {
    switch (attributeClassName) {
      case "userId":
        return `CYO${Math.floor(Math.random() * 999)}`; // Company size from 0 to 5000 employees
      case "email":
        return `${name.split(" ")[0].toLowerCase()}@calendyo.com`;
      case "Name":
        return name;
      case "Role":
        const roles = ["Manager", "Employee", "Developer", "Designer", "Product Manager", "Marketing"];
        return roles[i % roles.length]; // This ensures even distribution of roles among the people
      case "Experience":
        return `${Math.floor(Math.random() * 11)} years`; // Experience from 0 to 10 years
      case "Usage Frequency":
        const frequencies = ["Daily", "Weekly", "Monthly", "Yearly"];
        return frequencies[i % frequencies.length]; // This ensures even distribution of frequencies among the people
      case "Company Size":
        return `${Math.floor(Math.random() * 5001)} employees`; // Company size from 0 to 5000 employees
      case "Product Satisfaction Score":
        return `${Math.floor(Math.random() * 101)}`; // Satisfaction score from 0 to 100
      case "Recommendation Likelihood":
        return `${Math.floor(Math.random() * 11)}`; // Likelihood from 0 to 10
      default:
        return "Unknown";
    }
  }

  for (let i = 0; i < 20; i++) {
    // for each person, create a set of attributes that link to the attributeClasses
    const attributes = attributeClasses.map((attributeClass) => {
      let value = generateAttributeValue(attributeClass.name, names[i], i);
      return {
        attributeClass: { connect: { id: attributeClass.id } },
        value: value,
      };
    });

    const person = await prisma.person.create({
      data: {
        environment: { connect: { id: product.environments[0].id } },
        attributes: { create: attributes },
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
      environment: { connect: { id: product.environments[0].id } },
      questions: preset.questions as any,
      responses: {
        create: responses,
      },
      displays: {
        create: displays,
      },
    },
  });
}
