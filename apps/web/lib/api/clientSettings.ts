import { prisma } from "@formbricks/database";
import { Settings } from "@formbricks/types/js";

export const getSettings = async (environmentId: string, personId: string): Promise<Settings> => {
  // get recontactDays from product
  const product = await prisma.product.findFirst({
    where: {
      environments: {
        some: {
          id: environmentId,
        },
      },
    },
    select: {
      recontactDays: true,
    },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  // get all surveys that meed the displayOption criteria
  const potentialSurveys = await prisma.survey.findMany({
    where: {
      OR: [
        {
          environmentId,
          type: "web",
          status: "inProgress",
          displayOption: "respondMultiple",
        },
        {
          environmentId,
          type: "web",
          status: "inProgress",
          displayOption: "displayOnce",
          displays: { none: { personId } },
        },
        {
          environmentId,
          type: "web",
          status: "inProgress",
          displayOption: "displayMultiple",
          displays: { none: { personId, status: "responded" } },
        },
      ],
    },
    select: {
      id: true,
      questions: true,
      recontactDays: true,
      triggers: {
        select: {
          id: true,
          eventClass: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      // last display
      displays: {
        where: {
          personId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          createdAt: true,
        },
      },
    },
  });

  // get last display for this person
  const lastDisplayPerson = await prisma.display.findFirst({
    where: {
      personId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      createdAt: true,
    },
  });

  // filter surveys that meet the recontactDays criteria
  const surveys = potentialSurveys
    .filter((survey) => {
      if (!lastDisplayPerson) {
        // no display yet - always display
        return true;
      } else if (survey.recontactDays !== null) {
        // if recontactDays is set on survey, use that
        const lastDisplaySurvey = survey.displays[0];
        if (!lastDisplaySurvey) {
          // no display yet - always display
          return true;
        }
        const lastDisplayDate = new Date(lastDisplaySurvey.createdAt);
        const currentDate = new Date();
        const diffTime = Math.abs(currentDate.getTime() - lastDisplayDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= survey.recontactDays;
      } else if (product.recontactDays !== null) {
        // if recontactDays is not set in survey, use product recontactDays
        const lastDisplayDate = new Date(lastDisplayPerson.createdAt);
        const currentDate = new Date();
        const diffTime = Math.abs(currentDate.getTime() - lastDisplayDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= product.recontactDays;
      } else {
        // if recontactDays is not set in survey or product, always display
        return true;
      }
    })
    .map((survey) => {
      return {
        id: survey.id,
        questions: JSON.parse(JSON.stringify(survey.questions)),
        triggers: survey.triggers,
      };
    });

  const noCodeEvents = await prisma.eventClass.findMany({
    where: {
      environmentId,
      type: "noCode",
    },
    select: {
      name: true,
      noCodeConfig: true,
    },
  });

  const environmentProdut = await prisma.environment.findUnique({
    where: {
      id: environmentId,
    },
    select: {
      product: {
        select: {
          brandColor: true,
        },
      },
    },
  });

  const brandColor = environmentProdut?.product.brandColor;

  return { surveys, noCodeEvents, brandColor };
};
