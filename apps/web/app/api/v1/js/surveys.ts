import { prisma } from "@formbricks/database";
import { selectSurvey } from "@formbricks/lib/services/survey";
import { TPerson } from "@formbricks/types/v1/people";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { evaluateSegment } from "@formbricks/lib/services/userSegment";
import { ZUserSegmentFilterGroup } from "@formbricks/types/v1/userSegment";
import { unstable_cache } from "next/cache";

const getSurveysCacheTags = (environmentId: string, personId: string): string[] => [
  `env-${environmentId}-surveys`,
  `env-${environmentId}-product`,
  personId,
];

const getSurveysCacheKey = (environmentId: string, personId: string): string[] => [
  `env-${environmentId}-person-${personId}-syncSurveys`,
];

export const getSurveysCached = (environmentId: string, person: TPerson, sessionId: string) =>
  unstable_cache(
    async () => {
      return await getSurveys(environmentId, person, sessionId);
    },
    getSurveysCacheKey(environmentId, person.id),
    {
      tags: getSurveysCacheTags(environmentId, person.id),
      revalidate: 30 * 60,
    }
  )();

export const getSurveys = async (
  environmentId: string,
  person: TPerson,
  sessionId: string
): Promise<TSurvey[]> => {
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

  // get user's device type
  const session = await prisma.session.findUnique({
    where: {
      id: sessionId,
    },
    select: {
      deviceType: true,
    },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  const { deviceType } = session;

  // get the attribute class ids that are used in the user segment
  const personAttributeClasses = await prisma.person.findUnique({
    where: {
      id: person.id,
    },
    include: {
      attributes: true,
    },
  });

  const personActions = await prisma.event.findMany({
    where: {
      session: {
        personId: person.id,
      },
      eventClass: {
        environmentId,
      },
    },
  });

  const personAttributeClassIds = personAttributeClasses?.attributes?.reduce(
    (acc: Record<string, string>, attribute) => {
      acc[attribute.attributeClassId] = attribute.value;
      return acc;
    },
    {}
  );

  const personActionClassIds = Array.from(new Set(personActions?.map((action) => action.eventClassId ?? "")));

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
          displays: { none: { personId: person.id } },
        },
        {
          environmentId,
          type: "web",
          status: "inProgress",
          displayOption: "displayMultiple",
          displays: { none: { personId: person.id, status: "responded" } },
        },
      ],
    },
    select: {
      ...selectSurvey,
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
          personId: person.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          createdAt: true,
        },
      },
      userSegment: {
        include: {
          surveys: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  type TPotentialSurvey = (typeof potentialSurveys)[number];

  // get last display for this person
  const lastDisplayPerson = await prisma.display.findFirst({
    where: {
      personId: person.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      createdAt: true,
    },
  });

  let potentialSurveysFiltered: TPotentialSurvey[] = [];

  if (!potentialSurveys.every((survey) => !survey.userSegment?.filters?.length)) {
    const surveyPromises = potentialSurveys.map(async (survey) => {
      const { userSegment } = survey;

      if (userSegment) {
        const parsedFilters = ZUserSegmentFilterGroup.safeParse(userSegment.filters);
        if (!parsedFilters.success) {
          throw new Error("Invalid user segment filters");
        }

        const result = await evaluateSegment(
          {
            attributes: personAttributeClassIds ?? {},
            actionIds: personActionClassIds,
            deviceType: deviceType ?? "desktop",
            environmentId,
            personId: person.id,
          },
          parsedFilters.data
        );

        if (result) {
          return survey;
        }
      }

      return null; // return null for surveys that don't match the criteria
    });

    // Wait for all promises to resolve and then filter out any null values
    const promisesResult = await Promise.all(surveyPromises);
    const filteredResult = promisesResult.filter((survey) => !!survey);

    potentialSurveysFiltered = filteredResult as TPotentialSurvey[];
  } else {
    potentialSurveysFiltered = potentialSurveys;
  }

  // filter surveys that meet the recontactDays criteria
  const surveys: TSurvey[] = potentialSurveysFiltered
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
    .map((survey) => ({
      ...survey,
      userSegment: {
        ...survey.userSegment,
        surveys: survey.userSegment?.surveys?.map((s) => s.id) ?? [],
      },
      triggers: survey.triggers.map((trigger) => trigger.eventClass),
      attributeFilters: survey.attributeFilters.map((af) => ({
        ...af,
        attributeClassId: af.attributeClass.id,
        attributeClass: undefined,
      })),
    }));

  return surveys;
};
