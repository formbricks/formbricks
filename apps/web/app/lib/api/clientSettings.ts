// import { prisma } from "@formbricks/database";
// import { selectSurvey } from "@formbricks/lib/services/survey";
// import { TPerson } from "@formbricks/types/people";
// import { TSurvey } from "@formbricks/types/surveys";
// import { evaluateSegment } from "@formbricks/lib/services/userSegment";
// import { ZUserSegmentFilterGroup } from "@formbricks/types/userSegment";
// import { unstable_cache } from "next/cache";
// // const getSurveysCacheTags = (environmentId: string, personId: string): string[] => [
// //   `env-${environmentId}-surveys`,
// //   `env-${environmentId}-product`,
// //   personId,
// // ];
// // const getSurveysCacheKey = (environmentId: string, personId: string): string[] => [
// //   `env-${environmentId}-person-${personId}-syncSurveys`,
// // ];
// // export const getSurveysCached = (environmentId: string, person: TPerson, sessionId: string) =>
// //   unstable_cache(
// //     async () => {
// //       return await getSurveys(environmentId, person, sessionId);
// //     },
// //     getSurveysCacheKey(environmentId, person.id),
// //     {
// //       tags: getSurveysCacheTags(environmentId, person.id),
// //       revalidate: 30 * 60,
// //     }
// //   )();
// export const getSurveys = async (
//   environmentId: string,
//   person: TPerson,
//   sessionId: string
// ): Promise<TSurvey[]> => {
// import { TSettings } from "@formbricks/types/js";
// export const getSettings = async (environmentId: string, personId: string): Promise<TSettings> => {
//   // get recontactDays from product
//   const product = await prisma.product.findFirst({
//     where: {
//       environments: {
//         some: {
//           id: environmentId,
//         },
//       },
//     },
//     select: {
//       recontactDays: true,
//     },
//   });
//   if (!product) {
//     throw new Error("Product not found");
//   }
//   // get user's device type
//   const session = await prisma.session.findUnique({
//     where: {
//       id: sessionId,
//     },
//     select: {
//       deviceType: true,
//     },
//   });
//   if (!session) {
//     throw new Error("Session not found");
//   }
//   const { deviceType } = session;
//   // get the attribute class ids that are used in the user segment
//   const personAttributeClasses = await prisma.person.findUnique({
//     where: {
//       id: person.id,
//     },
//     include: {
//       attributes: true,
//     },
//   });
//   const personActions = await prisma.event.findMany({
//     where: {
//       session: {
//         personId: person.id,
//       },
//       eventClass: {
//         environmentId,
//       },
//     },
//   });
//   const personAttributeClassIds = personAttributeClasses?.attributes?.reduce(
//     (acc: Record<string, string>, attribute) => {
//       acc[attribute.attributeClassId] = attribute.value;
//       return acc;
//     },
//     {}
//   );
//   const personActionClassIds = Array.from(new Set(personActions?.map((action) => action.eventClassId ?? "")));
//   const person = await prisma.person.findUnique({
//     where: {
//       id: personId,
//     },
//     select: {
//       attributes: {
//         select: {
//           id: true,
//           value: true,
//           attributeClassId: true,
//         },
//       },
//     },
//   });
//   if (!person) {
//     throw new Error("Person not found");
//   }
//   // get all surveys that meet the displayOption criteria
//   const potentialSurveys = await prisma.survey.findMany({
//     where: {
//       OR: [
//         {
//           environmentId,
//           type: "web",
//           status: "inProgress",
//           displayOption: "respondMultiple",
//         },
//         {
//           environmentId,
//           type: "web",
//           status: "inProgress",
//           displayOption: "displayOnce",
//           displays: { none: { personId } },
//         },
//         {
//           environmentId,
//           type: "web",
//           status: "inProgress",
//           displayOption: "displayMultiple",
//           displays: { none: { personId, status: "responded" } },
//         },
//       ],
//     },
//     select: {
//       id: true,
//       questions: true,
//       recontactDays: true,
//       triggers: {
//         select: {
//           id: true,
//           actionClass: {
//             select: {
//               id: true,
//               name: true,
//             },
//           },
//         },
//         // last display
//       },
//       attributeFilters: {
//         select: {
//           id: true,
//           condition: true,
//           value: true,
//           attributeClass: {
//             select: {
//               id: true,
//               name: true,
//             },
//           },
//         },
//       },
//       displays: {
//         where: {
//           personId,
//         },
//         orderBy: {
//           createdAt: "desc",
//         },
//         take: 1,
//         select: {
//           createdAt: true,
//         },
//       },
//       userSegment: {
//         include: {
//           surveys: {
//             select: {
//               id: true,
//             },
//           },
//         },
//       },
//       thankYouCard: true,
//       welcomeCard: true,
//       autoClose: true,
//       delay: true,
//     },
//   });
//   type TPotentialSurvey = (typeof potentialSurveys)[number];
//   // get last display for this person
//   const lastDisplayPerson = await prisma.display.findFirst({
//     where: {
//       personId,
//     },
//     orderBy: {
//       createdAt: "desc",
//     },
//     select: {
//       createdAt: true,
//     },
//   });
//   let potentialSurveysFiltered: TPotentialSurvey[] = [];
//   if (!potentialSurveys.every((survey) => !survey.userSegment?.filters?.length)) {
//     const surveyPromises = potentialSurveys.map(async (survey) => {
//       const { userSegment } = survey;
//       if (userSegment) {
//         const parsedFilters = ZUserSegmentFilterGroup.safeParse(userSegment.filters);
//         if (!parsedFilters.success) {
//           throw new Error("Invalid user segment filters");
//         }
//         const result = await evaluateSegment(
//           {
//             attributes: personAttributeClassIds ?? {},
//             actionIds: personActionClassIds,
//             deviceType: deviceType ?? "desktop",
//             environmentId,
//             personId: person.id,
//           },
//           parsedFilters.data
//         );
//         if (result) {
//           return survey;
//         }
//   // filter surveys that meet the attributeFilters criteria
//   const potentialSurveysWithAttributes = potentialSurveys.filter((survey) => {
//     const attributeFilters = survey.attributeFilters;
//     if (attributeFilters.length === 0) {
//       return true;
//     }
//     // check if meets all attribute filters criterias
//     return attributeFilters.every((attributeFilter) => {
//       const attribute = person.attributes.find(
//         (attribute) => attribute.attributeClassId === attributeFilter.attributeClass.id
//       );
//       if (attributeFilter.condition === "equals") {
//         return attribute?.value === attributeFilter.value;
//       } else if (attributeFilter.condition === "notEquals") {
//         return attribute?.value !== attributeFilter.value;
//       } else {
//         throw Error("Invalid attribute filter condition");
//       }
//       return null; // return null for surveys that don't match the criteria
//     });
//     // Wait for all promises to resolve and then filter out any null values
//     const promisesResult = await Promise.all(surveyPromises);
//     const filteredResult = promisesResult.filter((survey) => !!survey);
//     potentialSurveysFiltered = filteredResult as TPotentialSurvey[];
//   } else {
//     potentialSurveysFiltered = potentialSurveys;
//   }
//   // filter surveys that meet the recontactDays criteria
//   const surveys: TSurvey[] = potentialSurveysFiltered
//   const surveys = potentialSurveysWithAttributes
//     .filter((survey) => {
//       if (!lastDisplayPerson) {
//         // no display yet - always display
//         return true;
//       } else if (survey.recontactDays !== null) {
//         // if recontactDays is set on survey, use that
//         const lastDisplaySurvey = survey.displays[0];
//         if (!lastDisplaySurvey) {
//           // no display yet - always display
//           return true;
//         }
//         const lastDisplayDate = new Date(lastDisplaySurvey.createdAt);
//         const currentDate = new Date();
//         const diffTime = Math.abs(currentDate.getTime() - lastDisplayDate.getTime());
//         const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
//         return diffDays >= survey.recontactDays;
//       } else if (product.recontactDays !== null) {
//         // if recontactDays is not set in survey, use product recontactDays
//         const lastDisplayDate = new Date(lastDisplayPerson.createdAt);
//         const currentDate = new Date();
//         const diffTime = Math.abs(currentDate.getTime() - lastDisplayDate.getTime());
//         const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
//         return diffDays >= product.recontactDays;
//       } else {
//         // if recontactDays is not set in survey or product, always display
//         return true;
//       }
//     })
//     .map((survey) => ({
//       ...survey,
//       userSegment: {
//         ...survey.userSegment,
//         surveys: survey.userSegment?.surveys?.map((s) => s.id) ?? [],
//       },
//       triggers: survey.triggers.map((trigger) => trigger.eventClass),
//       attributeFilters: survey.attributeFilters.map((af) => ({
//         ...af,
//         attributeClassId: af.attributeClass.id,
//         attributeClass: undefined,
//       })),
//     }));
//     .map((survey) => {
//       return {
//         id: survey.id,
//         questions: JSON.parse(JSON.stringify(survey.questions)),
//         triggers: survey.triggers.map((trigger) => trigger.actionClass.name),
//         thankYouCard: JSON.parse(JSON.stringify(survey.thankYouCard)),
//         welcomeCard: JSON.parse(JSON.stringify(survey.welcomeCard)),
//         autoClose: survey.autoClose,
//         delay: survey.delay,
//       };
//     });
//   const noCodeEvents = await prisma.actionClass.findMany({
//     where: {
//       environmentId,
//       type: "noCode",
//     },
//     select: {
//       name: true,
//       noCodeConfig: true,
//     },
//   });
//   const environmentProdut = await prisma.environment.findUnique({
//     where: {
//       id: environmentId,
//     },
//     select: {
//       product: {
//         select: {
//           brandColor: true,
//           linkSurveyBranding: true,
//           placement: true,
//           darkOverlay: true,
//           clickOutsideClose: true,
//         },
//       },
//     },
//   });
//   const formbricksSignature = environmentProdut?.product.linkSurveyBranding;
//   const brandColor = environmentProdut?.product.brandColor;
//   const placement = environmentProdut?.product.placement;
//   const darkOverlay = environmentProdut?.product.darkOverlay;
//   const clickOutsideClose = environmentProdut?.product.clickOutsideClose;
//   return {
//     surveys,
//     noCodeEvents,
//     brandColor,
//     formbricksSignature,
//     placement,
//     darkOverlay,
//     clickOutsideClose,
//   };
// };
import { prisma } from "@formbricks/database";
import { TSettings } from "@formbricks/types/js";

export const getSettings = async (environmentId: string, personId: string): Promise<TSettings> => {
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
          actionClass: {
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
      welcomeCard: true,
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
        triggers: survey.triggers.map((trigger) => trigger.actionClass.name),
        thankYouCard: JSON.parse(JSON.stringify(survey.thankYouCard)),
        welcomeCard: JSON.parse(JSON.stringify(survey.welcomeCard)),
        autoClose: survey.autoClose,
        delay: survey.delay,
      };
    });

  const noCodeEvents = await prisma.actionClass.findMany({
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
          linkSurveyBranding: true,
          placement: true,
          darkOverlay: true,
          clickOutsideClose: true,
        },
      },
    },
  });

  const formbricksSignature = environmentProdut?.product.linkSurveyBranding;
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
