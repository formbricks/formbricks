import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@formbricks/database";
import {
  ChurnResponses,
  ChurnSurvey,
  DEMO_COMPANIES,
  DEMO_NAMES,
  EASResponses,
  EASSurvey,
  InterviewPromptResponses,
  InterviewPromptSurvey,
  OnboardingResponses,
  OnboardingSurvey,
  PMFResponses,
  PMFSurvey,
  generateAttributeValue,
  generateResponsesAndDisplays,
  userAgents,
} from "@/lib/products/createDemoProductHelpers";
import { Prisma } from "@prisma/client";
import { INTERNAL_SECRET } from "@formbricks/lib/constants";
import { createId } from "@paralleldrive/cuid2";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication

  if (req.headers["x-api-key"] !== INTERNAL_SECRET) {
    return res.status(401).json({
      code: "not_authenticated",
      message: "Not authenticated",
      details: {
        "x-Api-Key": "Header not provided or API Key invalid",
      },
    });
  }

  const teamId = req.query.teamId?.toString();
  if (teamId === undefined) {
    return res.status(400).json({ message: "Missing teamId" });
  }

  if (req.method === "POST") {
    const productWithEnvironment = Prisma.validator<Prisma.ProductArgs>()({
      include: {
        environments: true,
      },
    });

    type ProductWithEnvironment = Prisma.ProductGetPayload<typeof productWithEnvironment>;

    const demoProduct: ProductWithEnvironment = await prisma.product.create({
      data: {
        name: "Demo Product",
        team: {
          connect: {
            id: teamId,
          },
        },
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
      include: {
        environments: true,
      },
    });

    const prodEnvironment = demoProduct.environments.find((environment) => environment.type === "production");

    // add attributes to each environment of the product
    // dont add dev environment

    const updatedEnvironment = await prisma.environment.update({
      where: { id: prodEnvironment?.id },
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
              name: "Company",
              description: "The company they work at",
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
        eventClasses: true, // include eventClasses
      },
    });

    const eventClasses = updatedEnvironment.eventClasses;

    // check if updatedEnvironment exists and it has attributeClasses
    if (!updatedEnvironment || !updatedEnvironment.attributeClasses) {
      throw new Error("Attribute classes could not be created");
    }

    const attributeClasses = updatedEnvironment.attributeClasses;

    // create an array for all the events that will be created
    const eventPromises: {
      eventClassId: string;
      sessionId: string;
    }[] = [];

    // create an array for all the attributes that will be created
    const generatedAttributes: {
      attributeClassId: string;
      value: string;
      personId: string;
    }[] = [];

    // create an array containing all the person ids to be created
    const personIds = Array.from({ length: 20 }).map((_) => createId());

    // create an array containing all the session ids to be created
    const sessionIds = Array.from({ length: 20 }).map((_) => createId());

    // loop over the person ids and create attributes for each person
    personIds.forEach((personId, i: number) => {
      generatedAttributes.push(
        ...attributeClasses.map((attributeClass) => {
          let value = generateAttributeValue(
            attributeClass.name,
            DEMO_NAMES[i],
            DEMO_COMPANIES[i],
            `${DEMO_COMPANIES[i].toLowerCase().split(" ").join("")}.com`,
            i
          );

          return {
            attributeClassId: attributeClass.id,
            value: value,
            personId,
          };
        })
      );
    });

    await prisma.person.createMany({
      data: personIds.map((personId) => ({
        id: personId,
        environmentId: demoProduct.environments[0].id,
      })),
    });

    await prisma.session.createMany({
      data: sessionIds.map((sessionId, idx) => ({
        id: sessionId,
        personId: personIds[idx],
      })),
    });

    await prisma.attribute.createMany({
      data: generatedAttributes,
    });

    sessionIds.forEach((sessionId) => {
      for (let eventClass of eventClasses) {
        // create a random number of events for each event class
        const eventCount = Math.floor(Math.random() * 5) + 1;
        for (let j = 0; j < eventCount; j++) {
          eventPromises.push({
            eventClassId: eventClass.id,
            sessionId,
          });
        }
      }
    });

    try {
      await prisma.$transaction([
        prisma.event.createMany({
          data: eventPromises.map((eventPromise) => ({
            eventClassId: eventPromise.eventClassId,
            sessionId: eventPromise.sessionId,
          })),
        }),
      ]);
    } catch (err) {
      throw new Error(err);
    }

    // Create a function that creates a survey
    const createSurvey = async (survey, responses, displays) => {
      return await prisma.survey.create({
        data: {
          ...survey,
          environment: { connect: { id: demoProduct.environments[0].id } },
          questions: survey.questions as any,
          responses: { create: responses },
          displays: { create: displays },
        },
      });
    };

    const people = personIds.map((personId) => ({ id: personId }));
    const PMFResults = generateResponsesAndDisplays(people, PMFResponses, userAgents);
    const OnboardingResults = generateResponsesAndDisplays(people, OnboardingResponses, userAgents);
    const ChurnResults = generateResponsesAndDisplays(people, ChurnResponses, userAgents);
    const EASResults = generateResponsesAndDisplays(people, EASResponses, userAgents);
    const InterviewPromptResults = generateResponsesAndDisplays(people, InterviewPromptResponses, userAgents);

    // Create the surveys
    await createSurvey(PMFSurvey, PMFResults.responses, PMFResults.displays);
    await createSurvey(OnboardingSurvey, OnboardingResults.responses, OnboardingResults.displays);
    await createSurvey(ChurnSurvey, ChurnResults.responses, ChurnResults.displays);
    await createSurvey(EASSurvey, EASResults.responses, EASResults.displays);
    await createSurvey(
      InterviewPromptSurvey,
      InterviewPromptResults.responses,
      InterviewPromptResults.displays
    );

    return res.json(demoProduct);
  }
}
