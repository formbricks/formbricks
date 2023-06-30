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

  const person = await prisma.person.findUnique({
    where: {
      id: personId,
    },
    select: {
      attributes: {
        select: {
          id: true,
          value: true,
          attributeClassId: true,
        },
      },
    },
  });

  if (!person) {
    throw new Error("Person not found");
  }

  // get all surveys that meet the displayOption criteria
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
        // last display
      },
      attributeFilters: {
        select: {
          id: true,
          condition: true,
          value: true,
          attributeClass: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
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
      thankYouCard: true,
      autoClose: true,
      delay: true,
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

  // filter surveys that meet the attributeFilters criteria
  const potentialSurveysWithAttributes = potentialSurveys.filter((survey) => {
    const attributeFilters = survey.attributeFilters;
    if (attributeFilters.length === 0) {
      return true;
    }
    // check if meets all attribute filters criterias
    return attributeFilters.every((attributeFilter) => {
      const attribute = person.attributes.find(
        (attribute) => attribute.attributeClassId === attributeFilter.attributeClass.id
      );
      if (attributeFilter.condition === "equals") {
        return attribute?.value === attributeFilter.value;
      } else if (attributeFilter.condition === "notEquals") {
        return attribute?.value !== attributeFilter.value;
      } else {
        throw Error("Invalid attribute filter condition");
      }
    });
  });

  // filter surveys that meet the recontactDays criteria
  const surveys = potentialSurveysWithAttributes
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
        thankYouCard: JSON.parse(JSON.stringify(survey.thankYouCard)),
        autoClose: survey.autoClose,
        delay: survey.delay,
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
          formbricksSignature: true,
          placement: true,
          darkOverlay: true,
          clickOutsideClose: true,
        },
      },
    },
  });

  const formbricksSignature = environmentProdut?.product.formbricksSignature;
  const brandColor = environmentProdut?.product.brandColor;
  const placement = environmentProdut?.product.placement;
  const darkOverlay = environmentProdut?.product.darkOverlay;
  const clickOutsideClose = environmentProdut?.product.clickOutsideClose;

  return {
    surveys,
    noCodeEvents,
    brandColor,
    formbricksSignature,
    placement,
    darkOverlay,
    clickOutsideClose,
  };
};
