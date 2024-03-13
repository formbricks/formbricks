import "server-only";

import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { prisma } from "@formbricks/database";
import { TActionClass } from "@formbricks/types/actionClasses";
import { ZOptionalNumber } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TPerson } from "@formbricks/types/people";
import { TSegment, ZSegment, ZSegmentFilters } from "@formbricks/types/segment";
import { TSurvey, TSurveyInput, ZSurvey, ZSurveyWithRefinements } from "@formbricks/types/surveys";

import { getActionsByPersonId } from "../action/service";
import { getActionClasses } from "../actionClass/service";
import { ITEMS_PER_PAGE, SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { displayCache } from "../display/cache";
import { getDisplaysByPersonId } from "../display/service";
import { personCache } from "../person/cache";
import { getPerson } from "../person/service";
import { productCache } from "../product/cache";
import { getProductByEnvironmentId } from "../product/service";
import { responseCache } from "../response/cache";
import { segmentCache } from "../segment/cache";
import { createSegment, evaluateSegment, getSegment, updateSegment } from "../segment/service";
import { transformSegmentFiltersToAttributeFilters } from "../segment/utils";
import { subscribeTeamMembersToSurveyResponses } from "../team/service";
import { diffInDays, formatDateFields } from "../utils/datetime";
import { validateInputs } from "../utils/validate";
import { surveyCache } from "./cache";
import { anySurveyHasFilters } from "./util";

interface TriggerUpdate {
  create?: Array<{ actionClassId: string }>;
  deleteMany?: {
    actionClassId: {
      in: string[];
    };
  };
}

export const selectSurvey = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  type: true,
  environmentId: true,
  createdBy: true,
  status: true,
  welcomeCard: true,
  questions: true,
  thankYouCard: true,
  hiddenFields: true,
  displayOption: true,
  recontactDays: true,
  autoClose: true,
  closeOnDate: true,
  delay: true,
  displayPercentage: true,
  autoComplete: true,
  verifyEmail: true,
  redirectUrl: true,
  productOverwrites: true,
  styling: true,
  surveyClosedMessage: true,
  singleUse: true,
  pin: true,
  resultShareKey: true,
  triggers: {
    select: {
      actionClass: {
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          environmentId: true,
          name: true,
          description: true,
          type: true,
          noCodeConfig: true,
        },
      },
    },
  },
  inlineTriggers: true,
  segment: {
    include: {
      surveys: {
        select: {
          id: true,
        },
      },
    },
  },
};

const getActionClassIdFromName = (actionClasses: TActionClass[], actionClassName: string): string => {
  return actionClasses.find((actionClass) => actionClass.name === actionClassName)!.id;
};

const revalidateSurveyByActionClassName = (
  actionClasses: TActionClass[],
  actionClassNames: string[]
): void => {
  for (const actionClassName of actionClassNames) {
    const actionClassId: string = getActionClassIdFromName(actionClasses, actionClassName);
    surveyCache.revalidate({
      actionClassId,
    });
  }
};

const processTriggerUpdates = (
  triggers: string[],
  currentSurveyTriggers: string[],
  actionClasses: TActionClass[]
) => {
  const newTriggers: string[] = [];
  const removedTriggers: string[] = [];

  // find added triggers
  for (const trigger of triggers) {
    if (!trigger || currentSurveyTriggers.includes(trigger)) {
      continue;
    }
    newTriggers.push(trigger);
  }

  // find removed triggers
  for (const trigger of currentSurveyTriggers) {
    if (!triggers.includes(trigger)) {
      removedTriggers.push(trigger);
    }
  }

  // Construct the triggers update object
  const triggersUpdate: TriggerUpdate = {};

  if (newTriggers.length > 0) {
    triggersUpdate.create = newTriggers.map((trigger) => ({
      actionClassId: getActionClassIdFromName(actionClasses, trigger),
    }));
  }

  if (removedTriggers.length > 0) {
    triggersUpdate.deleteMany = {
      actionClassId: {
        in: removedTriggers.map((trigger) => getActionClassIdFromName(actionClasses, trigger)),
      },
    };
  }
  revalidateSurveyByActionClassName(actionClasses, [...newTriggers, ...removedTriggers]);
  return triggersUpdate;
};

export const getSurvey = async (surveyId: string): Promise<TSurvey | null> => {
  const survey = await unstable_cache(
    async () => {
      validateInputs([surveyId, ZId]);

      let surveyPrisma;
      try {
        surveyPrisma = await prisma.survey.findUnique({
          where: {
            id: surveyId,
          },
          select: selectSurvey,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          console.error(error);
          throw new DatabaseError(error.message);
        }

        throw error;
      }

      if (!surveyPrisma) {
        return null;
      }

      let surveySegment: TSegment | null = null;
      if (surveyPrisma.segment) {
        surveySegment = formatDateFields(
          {
            ...surveyPrisma.segment,
            surveys: surveyPrisma.segment.surveys.map((survey) => survey.id),
          },
          ZSegment
        );
      }

      const transformedSurvey: TSurvey = {
        ...surveyPrisma,
        triggers: surveyPrisma.triggers.map((trigger) => trigger.actionClass.name),
        segment: surveySegment,
      };

      return transformedSurvey;
    },
    [`getSurvey-${surveyId}`],
    {
      tags: [surveyCache.tag.byId(surveyId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  // since the unstable_cache function does not support deserialization of dates, we need to manually deserialize them
  // https://github.com/vercel/next.js/issues/51613
  return survey ? formatDateFields(survey, ZSurvey) : null;
};

export const getSurveysByActionClassId = async (actionClassId: string, page?: number): Promise<TSurvey[]> => {
  const surveys = await unstable_cache(
    async () => {
      validateInputs([actionClassId, ZId], [page, ZOptionalNumber]);

      const surveysPrisma = await prisma.survey.findMany({
        where: {
          triggers: {
            some: {
              actionClass: {
                id: actionClassId,
              },
            },
          },
        },
        select: selectSurvey,
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
      });

      const surveys: TSurvey[] = [];

      for (const surveyPrisma of surveysPrisma) {
        let segment: TSegment | null = null;

        if (surveyPrisma.segment) {
          segment = {
            ...surveyPrisma.segment,
            surveys: surveyPrisma.segment.surveys.map((survey) => survey.id),
          };
        }

        const transformedSurvey: TSurvey = {
          ...surveyPrisma,
          triggers: surveyPrisma.triggers.map((trigger) => trigger.actionClass.name),
          segment,
        };
        surveys.push(transformedSurvey);
      }

      return surveys;
    },
    [`getSurveysByActionClassId-${actionClassId}-${page}`],
    {
      tags: [surveyCache.tag.byActionClassId(actionClassId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
  return surveys.map((survey) => formatDateFields(survey, ZSurvey));
};

export const getSurveys = async (environmentId: string, page?: number): Promise<TSurvey[]> => {
  const surveys = await unstable_cache(
    async () => {
      validateInputs([environmentId, ZId], [page, ZOptionalNumber]);
      let surveysPrisma;
      try {
        surveysPrisma = await prisma.survey.findMany({
          where: {
            environmentId,
          },
          select: selectSurvey,
          take: page ? ITEMS_PER_PAGE : undefined,
          skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          console.error(error);
          throw new DatabaseError(error.message);
        }

        throw error;
      }

      const surveys: TSurvey[] = [];

      for (const surveyPrisma of surveysPrisma) {
        let segment: TSegment | null = null;

        if (surveyPrisma.segment) {
          segment = {
            ...surveyPrisma.segment,
            surveys: surveyPrisma.segment.surveys.map((survey) => survey.id),
          };
        }

        const transformedSurvey: TSurvey = {
          ...surveyPrisma,
          triggers: surveyPrisma.triggers.map((trigger) => trigger.actionClass.name),
          segment,
        };

        surveys.push(transformedSurvey);
      }
      return surveys;
    },
    [`getSurveys-${environmentId}-${page}`],
    {
      tags: [surveyCache.tag.byEnvironmentId(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  // since the unstable_cache function does not support deserialization of dates, we need to manually deserialize them
  // https://github.com/vercel/next.js/issues/51613
  return surveys.map((survey) => formatDateFields(survey, ZSurvey));
};

export const updateSurvey = async (updatedSurvey: TSurvey): Promise<TSurvey> => {
  validateInputs([updatedSurvey, ZSurveyWithRefinements]);

  const surveyId = updatedSurvey.id;
  let data: any = {};

  const actionClasses = await getActionClasses(updatedSurvey.environmentId);
  const currentSurvey = await getSurvey(surveyId);

  if (!currentSurvey) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }

  const { triggers, environmentId, segment, ...surveyData } = updatedSurvey;

  if (triggers) {
    data.triggers = processTriggerUpdates(triggers, currentSurvey.triggers, actionClasses);
  }

  if (segment) {
    // parse the segment filters:
    const parsedFilters = ZSegmentFilters.safeParse(segment.filters);
    if (!parsedFilters.success) {
      throw new InvalidInputError("Invalid user segment filters");
    }

    try {
      await updateSegment(segment.id, segment);
    } catch (error) {
      console.error(error);
      throw new Error("Error updating survey");
    }
  }

  surveyData.updatedAt = new Date();
  data = {
    ...surveyData,
    ...data,
  };

  try {
    const prismaSurvey = await prisma.survey.update({
      where: { id: surveyId },
      data,
      select: selectSurvey,
    });

    let surveySegment: TSegment | null = null;
    if (prismaSurvey.segment) {
      surveySegment = {
        ...prismaSurvey.segment,
        surveys: prismaSurvey.segment.surveys.map((survey) => survey.id),
      };
    }

    const modifiedSurvey: TSurvey = {
      ...prismaSurvey, // Properties from prismaSurvey
      triggers: updatedSurvey.triggers ? updatedSurvey.triggers : [], // Include triggers from updatedSurvey
      segment: surveySegment,
    };

    surveyCache.revalidate({
      id: modifiedSurvey.id,
      environmentId: modifiedSurvey.environmentId,
      segmentId: modifiedSurvey.segment?.id,
    });

    return modifiedSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(error);
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export async function deleteSurvey(surveyId: string) {
  validateInputs([surveyId, ZId]);

  const deletedSurvey = await prisma.survey.delete({
    where: {
      id: surveyId,
    },
    select: selectSurvey,
  });

  responseCache.revalidate({
    surveyId,
    environmentId: deletedSurvey.environmentId,
  });
  surveyCache.revalidate({
    id: deletedSurvey.id,
    environmentId: deletedSurvey.environmentId,
  });

  if (deletedSurvey.segment?.id) {
    segmentCache.revalidate({
      id: deletedSurvey.segment.id,
      environmentId: deletedSurvey.environmentId,
    });
  }

  // Revalidate triggers by actionClassId
  deletedSurvey.triggers.forEach((trigger) => {
    surveyCache.revalidate({
      actionClassId: trigger.actionClass.id,
    });
  });

  return deletedSurvey;
}

export const createSurvey = async (environmentId: string, surveyBody: TSurveyInput): Promise<TSurvey> => {
  validateInputs([environmentId, ZId]);

  // if the survey body has both triggers and inlineTriggers, we throw an error
  if (surveyBody.triggers && surveyBody.inlineTriggers) {
    throw new InvalidInputError("Survey body cannot have both triggers and inlineTriggers");
  }

  if (surveyBody.triggers) {
    const actionClasses = await getActionClasses(environmentId);
    revalidateSurveyByActionClassName(actionClasses, surveyBody.triggers);
  }

  const createdBy = surveyBody.createdBy;
  delete surveyBody.createdBy;

  const data: Omit<Prisma.SurveyCreateInput, "environment"> = {
    ...surveyBody,
    // TODO: Create with attributeFilters
    triggers: surveyBody.triggers
      ? processTriggerUpdates(surveyBody.triggers, [], await getActionClasses(environmentId))
      : undefined,
    attributeFilters: undefined,
  };

  if (surveyBody.type === "web" && data.thankYouCard) {
    data.thankYouCard.buttonLabel = "";
    data.thankYouCard.buttonLink = "";
  }

  if (createdBy) {
    data.creator = {
      connect: {
        id: createdBy,
      },
    };
  }

  const survey = await prisma.survey.create({
    data: {
      ...data,
      environment: {
        connect: {
          id: environmentId,
        },
      },
    },
    select: selectSurvey,
  });

  const transformedSurvey: TSurvey = {
    ...survey,
    triggers: survey.triggers.map((trigger) => trigger.actionClass.name),
    segment: null,
  };

  await subscribeTeamMembersToSurveyResponses(environmentId, survey.id);

  surveyCache.revalidate({
    id: survey.id,
    environmentId: survey.environmentId,
  });

  return transformedSurvey;
};

export const duplicateSurvey = async (environmentId: string, surveyId: string, userId: string) => {
  validateInputs([environmentId, ZId], [surveyId, ZId]);
  const existingSurvey = await getSurvey(surveyId);
  const currentDate = new Date();
  if (!existingSurvey) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }

  const actionClasses = await getActionClasses(environmentId);

  // create new survey with the data of the existing survey
  const newSurvey = await prisma.survey.create({
    data: {
      ...existingSurvey,
      id: undefined, // id is auto-generated
      environmentId: undefined, // environmentId is set below
      createdAt: currentDate,
      updatedAt: currentDate,
      createdBy: undefined,
      name: `${existingSurvey.name} (copy)`,
      status: "draft",
      questions: JSON.parse(JSON.stringify(existingSurvey.questions)),
      thankYouCard: JSON.parse(JSON.stringify(existingSurvey.thankYouCard)),
      triggers: {
        create: existingSurvey.triggers.map((trigger) => ({
          actionClassId: getActionClassIdFromName(actionClasses, trigger),
        })),
      },
      inlineTriggers: existingSurvey.inlineTriggers ?? undefined,
      environment: {
        connect: {
          id: environmentId,
        },
      },
      creator: {
        connect: {
          id: userId,
        },
      },
      surveyClosedMessage: existingSurvey.surveyClosedMessage
        ? JSON.parse(JSON.stringify(existingSurvey.surveyClosedMessage))
        : Prisma.JsonNull,
      singleUse: existingSurvey.singleUse
        ? JSON.parse(JSON.stringify(existingSurvey.singleUse))
        : Prisma.JsonNull,
      productOverwrites: existingSurvey.productOverwrites
        ? JSON.parse(JSON.stringify(existingSurvey.productOverwrites))
        : Prisma.JsonNull,
      styling: existingSurvey.styling ? JSON.parse(JSON.stringify(existingSurvey.styling)) : Prisma.JsonNull,
      verifyEmail: existingSurvey.verifyEmail
        ? JSON.parse(JSON.stringify(existingSurvey.verifyEmail))
        : Prisma.JsonNull,
      // we'll update the segment later
      segment: undefined,
    },
  });

  // if the existing survey has an inline segment, we copy the filters and create a new inline segment and connect it to the new survey
  if (existingSurvey.segment) {
    if (existingSurvey.segment.isPrivate) {
      const newInlineSegment = await createSegment({
        environmentId,
        title: `${newSurvey.id}`,
        isPrivate: true,
        surveyId: newSurvey.id,
        filters: existingSurvey.segment.filters,
      });

      await prisma.survey.update({
        where: {
          id: newSurvey.id,
        },
        data: {
          segment: {
            connect: {
              id: newInlineSegment.id,
            },
          },
        },
      });

      segmentCache.revalidate({
        id: newInlineSegment.id,
        environmentId: newSurvey.environmentId,
      });
    } else {
      await prisma.survey.update({
        where: {
          id: newSurvey.id,
        },
        data: {
          segment: {
            connect: {
              id: existingSurvey.segment.id,
            },
          },
        },
      });

      segmentCache.revalidate({
        id: existingSurvey.segment.id,
        environmentId: newSurvey.environmentId,
      });
    }
  }

  surveyCache.revalidate({
    id: newSurvey.id,
    environmentId: newSurvey.environmentId,
  });

  // Revalidate surveys by actionClassId
  revalidateSurveyByActionClassName(actionClasses, existingSurvey.triggers);

  return newSurvey;
};

export const getSyncSurveys = async (
  environmentId: string,
  personId: string,
  deviceType: "phone" | "desktop" = "desktop",
  options?: {
    version?: string;
  }
): Promise<TSurvey[]> => {
  validateInputs([environmentId, ZId]);

  const surveys = await unstable_cache(
    async () => {
      const product = await getProductByEnvironmentId(environmentId);
      const person = personId === "legacy" ? ({ id: "legacy" } as TPerson) : await getPerson(personId);

      if (!product) {
        throw new Error("Product not found");
      }

      if (!person) {
        throw new Error("Person not found");
      }

      let surveys = await getSurveys(environmentId);

      // filtered surveys for running and web
      surveys = surveys.filter((survey) => survey.status === "inProgress" && survey.type === "web");

      const displays = await getDisplaysByPersonId(person.id);

      // filter surveys that meet the displayOption criteria
      surveys = surveys.filter((survey) => {
        if (survey.displayOption === "respondMultiple") {
          return true;
        } else if (survey.displayOption === "displayOnce") {
          return displays.filter((display) => display.surveyId === survey.id).length === 0;
        } else if (survey.displayOption === "displayMultiple") {
          return (
            displays.filter((display) => display.surveyId === survey.id && display.responseId !== null)
              .length === 0
          );
        } else {
          throw Error("Invalid displayOption");
        }
      });

      const latestDisplay = displays[0];

      // filter surveys that meet the recontactDays criteria
      surveys = surveys.filter((survey) => {
        if (!latestDisplay) {
          return true;
        } else if (survey.recontactDays !== null) {
          const lastDisplaySurvey = displays.filter((display) => display.surveyId === survey.id)[0];
          if (!lastDisplaySurvey) {
            return true;
          }
          return diffInDays(new Date(), new Date(lastDisplaySurvey.createdAt)) >= survey.recontactDays;
        } else if (product.recontactDays !== null) {
          return diffInDays(new Date(), new Date(latestDisplay.createdAt)) >= product.recontactDays;
        } else {
          return true;
        }
      });

      // if no surveys have segment filters, return the surveys
      if (!anySurveyHasFilters(surveys)) {
        return surveys;
      }

      const personActions = await getActionsByPersonId(person.id);
      const personActionClassIds = Array.from(
        new Set(personActions?.map((action) => action.actionClass?.id ?? ""))
      );
      const personUserId = person.userId ?? person.attributes?.userId ?? "";

      // the surveys now have segment filters, so we need to evaluate them
      const surveyPromises = surveys.map(async (survey) => {
        const { segment } = survey;
        if (!segment) {
          return survey;
        }

        // backwards compatibility for older versions of the js package
        // if the version is not provided, we will use the old method of evaluating the segment, which is attribute filters
        // transform the segment filters to attribute filters and evaluate them
        if (!options?.version) {
          const attributeFilters = transformSegmentFiltersToAttributeFilters(segment.filters);

          // if the attribute filters are null, it means the segment filters don't match the expected format for attribute filters, so we skip this survey
          if (attributeFilters === null) {
            return null;
          }

          // if there are no attribute filters, we return the survey
          if (!attributeFilters.length) {
            return survey;
          }

          // we check if the person meets the attribute filters for all the attribute filters
          const isEligible = attributeFilters.every((attributeFilter) => {
            const personAttributeValue = person?.attributes?.[attributeFilter.attributeClassName];
            if (!personAttributeValue) {
              return false;
            }

            if (attributeFilter.operator === "equals") {
              return personAttributeValue === attributeFilter.value;
            } else if (attributeFilter.operator === "notEquals") {
              return personAttributeValue !== attributeFilter.value;
            } else {
              // if the operator is not equals or not equals, we skip the survey, this means that new segment filter options are being used
              return false;
            }
          });

          return isEligible ? survey : null;
        }

        // Evaluate the segment filters
        const result = await evaluateSegment(
          {
            attributes: person.attributes ?? {},
            actionIds: personActionClassIds,
            deviceType,
            environmentId,
            personId: person.id,
            userId: personUserId,
          },
          segment.filters
        );

        return result ? survey : null;
      });

      const resolvedSurveys = await Promise.all(surveyPromises);
      surveys = resolvedSurveys.filter((survey) => !!survey) as TSurvey[];

      if (!surveys) {
        throw new ResourceNotFoundError("Survey", environmentId);
      }

      return surveys;
    },
    [`getSyncSurveys-${environmentId}-${personId}`],
    {
      tags: [
        personCache.tag.byEnvironmentId(environmentId),
        personCache.tag.byId(personId),
        displayCache.tag.byPersonId(personId),
        surveyCache.tag.byEnvironmentId(environmentId),
        productCache.tag.byEnvironmentId(environmentId),
      ],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return surveys.map((survey) => formatDateFields(survey, ZSurvey));
};

export const getSurveyIdByResultShareKey = async (resultShareKey: string): Promise<string | null> => {
  try {
    const survey = await prisma.survey.findFirst({
      where: {
        resultShareKey,
      },
      select: {
        id: true,
      },
    });

    if (!survey) {
      return null;
    }

    return survey.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const loadNewSegmentInSurvey = async (surveyId: string, newSegmentId: string): Promise<TSurvey> => {
  try {
    validateInputs([surveyId, ZId], [newSegmentId, ZId]);

    const currentSurvey = await getSurvey(surveyId);
    if (!currentSurvey) {
      throw new ResourceNotFoundError("survey", surveyId);
    }

    const currentSegment = await getSegment(newSegmentId);
    if (!currentSegment) {
      throw new ResourceNotFoundError("segment", newSegmentId);
    }

    const prismaSurvey = await prisma.survey.update({
      where: {
        id: surveyId,
      },
      select: selectSurvey,
      data: {
        segment: {
          connect: {
            id: newSegmentId,
          },
        },
      },
    });

    segmentCache.revalidate({ id: newSegmentId });
    surveyCache.revalidate({ id: surveyId });

    let surveySegment: TSegment | null = null;
    if (prismaSurvey.segment) {
      surveySegment = {
        ...prismaSurvey.segment,
        surveys: prismaSurvey.segment.surveys.map((survey) => survey.id),
      };
    }

    const modifiedSurvey: TSurvey = {
      ...prismaSurvey, // Properties from prismaSurvey
      triggers: prismaSurvey.triggers.map((trigger) => trigger.actionClass.name),
      segment: surveySegment,
    };

    return modifiedSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getSurveysBySegmentId = async (segmentId: string): Promise<TSurvey[]> => {
  const surveys = await unstable_cache(
    async () => {
      try {
        const surveysPrisma = await prisma.survey.findMany({
          where: { segmentId },
          select: selectSurvey,
        });

        const surveys: TSurvey[] = [];

        for (const surveyPrisma of surveysPrisma) {
          let segment: TSegment | null = null;

          if (surveyPrisma.segment) {
            segment = {
              ...surveyPrisma.segment,
              surveys: surveyPrisma.segment.surveys.map((survey) => survey.id),
            };
          }

          const transformedSurvey: TSurvey = {
            ...surveyPrisma,
            triggers: surveyPrisma.triggers.map((trigger) => trigger.actionClass.name),
            segment,
          };
          surveys.push(transformedSurvey);
        }

        return surveys;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getSurveysBySegmentId-${segmentId}`],
    {
      tags: [surveyCache.tag.bySegmentId(segmentId), segmentCache.tag.byId(segmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return surveys;
};
