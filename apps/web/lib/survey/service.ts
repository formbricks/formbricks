import "server-only";
import { cache } from "@/lib/cache";
import { segmentCache } from "@/lib/cache/segment";
import {
  getOrganizationByEnvironmentId,
  subscribeOrganizationMembersToSurveyResponses,
} from "@/lib/organization/service";
import { ActionClass, Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSegment, ZSegmentFilters } from "@formbricks/types/segment";
import { TSurvey, TSurveyCreateInput, ZSurvey, ZSurveyCreateInput } from "@formbricks/types/surveys/types";
import { getActionClasses } from "../actionClass/service";
import { ITEMS_PER_PAGE } from "../constants";
import { capturePosthogEnvironmentEvent } from "../posthogServer";
import { validateInputs } from "../utils/validate";
import { surveyCache } from "./cache";
import { checkForInvalidImagesInQuestions, transformPrismaSurvey } from "./utils";

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
  endings: true,
  hiddenFields: true,
  variables: true,
  displayOption: true,
  recontactDays: true,
  displayLimit: true,
  autoClose: true,
  runOnDate: true,
  closeOnDate: true,
  delay: true,
  displayPercentage: true,
  autoComplete: true,
  isVerifyEmailEnabled: true,
  isSingleResponsePerEmailEnabled: true,
  isBackButtonHidden: true,
  redirectUrl: true,
  projectOverwrites: true,
  styling: true,
  surveyClosedMessage: true,
  singleUse: true,
  pin: true,
  resultShareKey: true,
  showLanguageSwitch: true,
  recaptcha: true,
  languages: {
    select: {
      default: true,
      enabled: true,
      language: {
        select: {
          id: true,
          code: true,
          alias: true,
          createdAt: true,
          updatedAt: true,
          projectId: true,
        },
      },
    },
  },
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
          key: true,
          noCodeConfig: true,
        },
      },
    },
  },
  segment: {
    include: {
      surveys: {
        select: {
          id: true,
        },
      },
    },
  },
  followUps: true,
} satisfies Prisma.SurveySelect;

export const checkTriggersValidity = (triggers: TSurvey["triggers"], actionClasses: ActionClass[]) => {
  if (!triggers) return;

  // check if all the triggers are valid
  triggers.forEach((trigger) => {
    if (!actionClasses.find((actionClass) => actionClass.id === trigger.actionClass.id)) {
      throw new InvalidInputError("Invalid trigger id");
    }
  });

  // check if all the triggers are unique
  const triggerIds = triggers.map((trigger) => trigger.actionClass.id);

  if (new Set(triggerIds).size !== triggerIds.length) {
    throw new InvalidInputError("Duplicate trigger id");
  }
};

export const handleTriggerUpdates = (
  updatedTriggers: TSurvey["triggers"],
  currentTriggers: TSurvey["triggers"],
  actionClasses: ActionClass[]
) => {
  if (!updatedTriggers) return {};
  checkTriggersValidity(updatedTriggers, actionClasses);

  const currentTriggerIds = currentTriggers.map((trigger) => trigger.actionClass.id);
  const updatedTriggerIds = updatedTriggers.map((trigger) => trigger.actionClass.id);

  // added triggers are triggers that are not in the current triggers and are there in the new triggers
  const addedTriggers = updatedTriggers.filter(
    (trigger) => !currentTriggerIds.includes(trigger.actionClass.id)
  );

  // deleted triggers are triggers that are not in the new triggers and are there in the current triggers
  const deletedTriggers = currentTriggers.filter(
    (trigger) => !updatedTriggerIds.includes(trigger.actionClass.id)
  );

  // Construct the triggers update object
  const triggersUpdate: TriggerUpdate = {};

  if (addedTriggers.length > 0) {
    triggersUpdate.create = addedTriggers.map((trigger) => ({
      actionClassId: trigger.actionClass.id,
    }));
  }

  if (deletedTriggers.length > 0) {
    // disconnect the public triggers from the survey
    triggersUpdate.deleteMany = {
      actionClassId: {
        in: deletedTriggers.map((trigger) => trigger.actionClass.id),
      },
    };
  }

  [...addedTriggers, ...deletedTriggers].forEach((trigger) => {
    surveyCache.revalidate({
      actionClassId: trigger.actionClass.id,
    });
  });

  return triggersUpdate;
};

export const getSurvey = reactCache(
  async (surveyId: string): Promise<TSurvey | null> =>
    cache(
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
            logger.error(error, "Error getting survey");
            throw new DatabaseError(error.message);
          }
          throw error;
        }

        if (!surveyPrisma) {
          return null;
        }

        return transformPrismaSurvey<TSurvey>(surveyPrisma);
      },
      [`getSurvey-${surveyId}`],
      {
        tags: [surveyCache.tag.byId(surveyId)],
      }
    )()
);

export const getSurveysByActionClassId = reactCache(
  async (actionClassId: string, page?: number): Promise<TSurvey[]> =>
    cache(
      async () => {
        validateInputs([actionClassId, ZId], [page, ZOptionalNumber]);

        let surveysPrisma;
        try {
          surveysPrisma = await prisma.survey.findMany({
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
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            logger.error(error, "Error getting surveys by action class id");
            throw new DatabaseError(error.message);
          }

          throw error;
        }

        const surveys: TSurvey[] = [];

        for (const surveyPrisma of surveysPrisma) {
          const transformedSurvey = transformPrismaSurvey<TSurvey>(surveyPrisma);
          surveys.push(transformedSurvey);
        }

        return surveys;
      },
      [`getSurveysByActionClassId-${actionClassId}-${page}`],
      {
        tags: [surveyCache.tag.byActionClassId(actionClassId)],
      }
    )()
);

export const getSurveys = reactCache(
  async (environmentId: string, limit?: number, offset?: number): Promise<TSurvey[]> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId], [limit, ZOptionalNumber], [offset, ZOptionalNumber]);

        try {
          const surveysPrisma = await prisma.survey.findMany({
            where: {
              environmentId,
            },
            select: selectSurvey,
            orderBy: {
              updatedAt: "desc",
            },
            take: limit,
            skip: offset,
          });

          return surveysPrisma.map((surveyPrisma) => transformPrismaSurvey<TSurvey>(surveyPrisma));
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            logger.error(error, "Error getting surveys");
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getSurveys-${environmentId}-${limit}-${offset}`],
      {
        tags: [surveyCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

export const getSurveyCount = reactCache(
  async (environmentId: string): Promise<number> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);
        try {
          const surveyCount = await prisma.survey.count({
            where: {
              environmentId: environmentId,
            },
          });

          return surveyCount;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            logger.error(error, "Error getting survey count");
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getSurveyCount-${environmentId}`],
      {
        tags: [surveyCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

export const updateSurvey = async (updatedSurvey: TSurvey): Promise<TSurvey> => {
  validateInputs([updatedSurvey, ZSurvey]);

  try {
    const surveyId = updatedSurvey.id;
    let data: any = {};

    const actionClasses = await getActionClasses(updatedSurvey.environmentId);
    const currentSurvey = await getSurvey(surveyId);

    if (!currentSurvey) {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    const { triggers, environmentId, segment, questions, languages, type, followUps, ...surveyData } =
      updatedSurvey;

    checkForInvalidImagesInQuestions(questions);

    if (languages) {
      // Process languages update logic here
      // Extract currentLanguageIds and updatedLanguageIds
      const currentLanguageIds = currentSurvey.languages
        ? currentSurvey.languages.map((l) => l.language.id)
        : [];
      const updatedLanguageIds =
        languages.length > 1 ? updatedSurvey.languages.map((l) => l.language.id) : [];
      const enabledLanguageIds = languages.map((language) => {
        if (language.enabled) return language.language.id;
      });

      // Determine languages to add and remove
      const languagesToAdd = updatedLanguageIds.filter((id) => !currentLanguageIds.includes(id));
      const languagesToRemove = currentLanguageIds.filter((id) => !updatedLanguageIds.includes(id));

      const defaultLanguageId = updatedSurvey.languages.find((l) => l.default)?.language.id;

      // Prepare data for Prisma update
      data.languages = {};

      // Update existing languages for default value changes
      data.languages.updateMany = currentSurvey.languages.map((surveyLanguage) => ({
        where: { languageId: surveyLanguage.language.id },
        data: {
          default: surveyLanguage.language.id === defaultLanguageId,
          enabled: enabledLanguageIds.includes(surveyLanguage.language.id),
        },
      }));

      // Add new languages
      if (languagesToAdd.length > 0) {
        data.languages.create = languagesToAdd.map((languageId) => ({
          languageId: languageId,
          default: languageId === defaultLanguageId,
          enabled: enabledLanguageIds.includes(languageId),
        }));
      }

      // Remove languages no longer associated with the survey
      if (languagesToRemove.length > 0) {
        data.languages.deleteMany = languagesToRemove.map((languageId) => ({
          languageId: languageId,
          enabled: enabledLanguageIds.includes(languageId),
        }));
      }
    }

    if (triggers) {
      data.triggers = handleTriggerUpdates(triggers, currentSurvey.triggers, actionClasses);
    }

    // if the survey body has type other than "app" but has a private segment, we delete that segment, and if it has a public segment, we disconnect from to the survey
    if (segment) {
      if (type === "app") {
        // parse the segment filters:
        const parsedFilters = ZSegmentFilters.safeParse(segment.filters);
        if (!parsedFilters.success) {
          throw new InvalidInputError("Invalid user segment filters");
        }

        try {
          // update the segment:
          let updatedInput: Prisma.SegmentUpdateInput = {
            ...segment,
            surveys: undefined,
          };

          if (segment.surveys) {
            updatedInput = {
              ...segment,
              surveys: {
                connect: segment.surveys.map((surveyId) => ({ id: surveyId })),
              },
            };
          }

          const updatedSegment = await prisma.segment.update({
            where: { id: segment.id },
            data: updatedInput,
            select: {
              surveys: { select: { id: true } },
              environmentId: true,
              id: true,
            },
          });

          segmentCache.revalidate({ id: updatedSegment.id, environmentId: updatedSegment.environmentId });
          updatedSegment.surveys.forEach((survey) => surveyCache.revalidate({ id: survey.id }));
        } catch (error) {
          logger.error(error, "Error updating survey");
          throw new Error("Error updating survey");
        }
      } else {
        if (segment.isPrivate) {
          // disconnect the private segment first and then delete:
          await prisma.segment.update({
            where: { id: segment.id },
            data: {
              surveys: {
                disconnect: {
                  id: surveyId,
                },
              },
            },
          });

          // delete the private segment:
          await prisma.segment.delete({
            where: {
              id: segment.id,
            },
          });
        } else {
          await prisma.survey.update({
            where: {
              id: surveyId,
            },
            data: {
              segment: {
                disconnect: true,
              },
            },
          });
        }
      }

      segmentCache.revalidate({
        id: segment.id,
        environmentId: segment.environmentId,
      });
    } else if (type === "app") {
      if (!currentSurvey.segment) {
        await prisma.survey.update({
          where: {
            id: surveyId,
          },
          data: {
            segment: {
              connectOrCreate: {
                where: {
                  environmentId_title: {
                    environmentId,
                    title: surveyId,
                  },
                },
                create: {
                  title: surveyId,
                  isPrivate: true,
                  filters: [],
                  environment: {
                    connect: {
                      id: environmentId,
                    },
                  },
                },
              },
            },
          },
        });

        segmentCache.revalidate({
          environmentId,
        });
      }
    }

    if (followUps) {
      // Separate follow-ups into categories based on deletion flag
      const deletedFollowUps = followUps.filter((followUp) => followUp.deleted);
      const nonDeletedFollowUps = followUps.filter((followUp) => !followUp.deleted);

      // Get set of existing follow-up IDs from currentSurvey
      const existingFollowUpIds = new Set(currentSurvey.followUps.map((f) => f.id));

      // Separate non-deleted follow-ups into new and existing
      const existingFollowUps = nonDeletedFollowUps.filter((followUp) =>
        existingFollowUpIds.has(followUp.id)
      );
      const newFollowUps = nonDeletedFollowUps.filter((followUp) => !existingFollowUpIds.has(followUp.id));

      data.followUps = {
        // Update existing follow-ups
        updateMany: existingFollowUps.map((followUp) => ({
          where: {
            id: followUp.id,
          },
          data: {
            name: followUp.name,
            trigger: followUp.trigger,
            action: followUp.action,
          },
        })),
        // Create new follow-ups
        createMany:
          newFollowUps.length > 0
            ? {
                data: newFollowUps.map((followUp) => ({
                  name: followUp.name,
                  trigger: followUp.trigger,
                  action: followUp.action,
                })),
              }
            : undefined,
        // Delete follow-ups marked as deleted, regardless of whether they exist in DB
        deleteMany:
          deletedFollowUps.length > 0
            ? deletedFollowUps.map((followUp) => ({
                id: followUp.id,
              }))
            : undefined,
      };
    }

    data.questions = questions.map((question) => {
      const { isDraft, ...rest } = question;
      return rest;
    });

    const organization = await getOrganizationByEnvironmentId(environmentId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", null);
    }

    surveyData.updatedAt = new Date();

    data = {
      ...surveyData,
      ...data,
      type,
    };

    // Remove scheduled status when runOnDate is not set
    if (data.status === "scheduled" && data.runOnDate === null) {
      data.status = "inProgress";
    }
    // Set scheduled status when runOnDate is set and in the future on completed surveys
    if (
      (data.status === "completed" || data.status === "paused" || data.status === "inProgress") &&
      data.runOnDate &&
      data.runOnDate > new Date()
    ) {
      data.status = "scheduled";
    }

    delete data.createdBy;
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

    // TODO: Fix this, this happens because the survey type "web" is no longer in the zod types but its required in the schema for migration
    // @ts-expect-error
    const modifiedSurvey: TSurvey = {
      ...prismaSurvey, // Properties from prismaSurvey
      displayPercentage: Number(prismaSurvey.displayPercentage) || null,
      segment: surveySegment,
    };

    surveyCache.revalidate({
      id: modifiedSurvey.id,
      environmentId: modifiedSurvey.environmentId,
      segmentId: modifiedSurvey.segment?.id,
      resultShareKey: currentSurvey.resultShareKey ?? undefined,
    });

    return modifiedSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error updating survey");
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const createSurvey = async (
  environmentId: string,
  surveyBody: TSurveyCreateInput
): Promise<TSurvey> => {
  const [parsedEnvironmentId, parsedSurveyBody] = validateInputs(
    [environmentId, ZId],
    [surveyBody, ZSurveyCreateInput]
  );

  try {
    const { createdBy, ...restSurveyBody } = parsedSurveyBody;

    // empty languages array
    if (!restSurveyBody.languages?.length) {
      delete restSurveyBody.languages;
    }

    const actionClasses = await getActionClasses(parsedEnvironmentId);

    // @ts-expect-error
    let data: Omit<Prisma.SurveyCreateInput, "environment"> = {
      ...restSurveyBody,
      // TODO: Create with attributeFilters
      triggers: restSurveyBody.triggers
        ? handleTriggerUpdates(restSurveyBody.triggers, [], actionClasses)
        : undefined,
      attributeFilters: undefined,
    };

    if (createdBy) {
      data.creator = {
        connect: {
          id: createdBy,
        },
      };
    }

    const organization = await getOrganizationByEnvironmentId(parsedEnvironmentId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", null);
    }

    // Survey follow-ups
    if (restSurveyBody.followUps?.length) {
      data.followUps = {
        create: restSurveyBody.followUps.map((followUp) => ({
          name: followUp.name,
          trigger: followUp.trigger,
          action: followUp.action,
        })),
      };
    } else {
      delete data.followUps;
    }

    if (data.questions) {
      checkForInvalidImagesInQuestions(data.questions);
    }

    const survey = await prisma.survey.create({
      data: {
        ...data,
        environment: {
          connect: {
            id: parsedEnvironmentId,
          },
        },
      },
      select: selectSurvey,
    });

    // if the survey created is an "app" survey, we also create a private segment for it.
    if (survey.type === "app") {
      // const newSegment = await createSegment({
      //   environmentId: parsedEnvironmentId,
      //   surveyId: survey.id,
      //   filters: [],
      //   title: survey.id,
      //   isPrivate: true,
      // });

      const newSegment = await prisma.segment.create({
        data: {
          title: survey.id,
          filters: [],
          isPrivate: true,
          environment: {
            connect: {
              id: parsedEnvironmentId,
            },
          },
        },
      });

      await prisma.survey.update({
        where: {
          id: survey.id,
        },
        data: {
          segment: {
            connect: {
              id: newSegment.id,
            },
          },
        },
      });

      segmentCache.revalidate({
        id: newSegment.id,
        environmentId: survey.environmentId,
      });
    }

    // TODO: Fix this, this happens because the survey type "web" is no longer in the zod types but its required in the schema for migration
    // @ts-expect-error
    const transformedSurvey: TSurvey = {
      ...survey,
      ...(survey.segment && {
        segment: {
          ...survey.segment,
          surveys: survey.segment.surveys.map((survey) => survey.id),
        },
      }),
    };

    surveyCache.revalidate({
      id: survey.id,
      environmentId: survey.environmentId,
      resultShareKey: survey.resultShareKey ?? undefined,
    });

    if (createdBy) {
      await subscribeOrganizationMembersToSurveyResponses(survey.id, createdBy, organization.id);
    }

    await capturePosthogEnvironmentEvent(survey.environmentId, "survey created", {
      surveyId: survey.id,
      surveyType: survey.type,
    });

    return transformedSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error creating survey");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getSurveyIdByResultShareKey = reactCache(
  async (resultShareKey: string): Promise<string | null> =>
    cache(
      async () => {
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
            logger.error(error, "Error getting survey id by result share key");
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getSurveyIdByResultShareKey-${resultShareKey}`],
      {
        tags: [surveyCache.tag.byResultShareKey(resultShareKey)],
      }
    )()
);

export const loadNewSegmentInSurvey = async (surveyId: string, newSegmentId: string): Promise<TSurvey> => {
  validateInputs([surveyId, ZId], [newSegmentId, ZId]);
  try {
    const currentSurvey = await getSurvey(surveyId);
    if (!currentSurvey) {
      throw new ResourceNotFoundError("survey", surveyId);
    }

    const currentSurveySegment = currentSurvey.segment;

    const newSegment = await prisma.segment.findUnique({
      where: {
        id: newSegmentId,
      },
    });

    if (!newSegment) {
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

    if (
      currentSurveySegment &&
      currentSurveySegment.isPrivate &&
      currentSurveySegment.title === currentSurvey.id
    ) {
      const segment = await prisma.segment.delete({
        where: {
          id: currentSurveySegment.id,
        },
        select: {
          environmentId: true,
          surveys: {
            select: {
              id: true,
            },
          },
        },
      });

      segmentCache.revalidate({ id: currentSurveySegment.id });
      segment.surveys.forEach((survey) => surveyCache.revalidate({ id: survey.id }));
      surveyCache.revalidate({ environmentId: segment.environmentId });
    }

    segmentCache.revalidate({ id: newSegmentId });
    surveyCache.revalidate({ id: surveyId });

    let surveySegment: TSegment | null = null;
    if (prismaSurvey.segment) {
      surveySegment = {
        ...prismaSurvey.segment,
        surveys: prismaSurvey.segment.surveys.map((survey) => survey.id),
      };
    }

    // TODO: Fix this, this happens because the survey type "web" is no longer in the zod types but its required in the schema for migration
    // @ts-expect-error
    const modifiedSurvey: TSurvey = {
      ...prismaSurvey, // Properties from prismaSurvey
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

export const getSurveysBySegmentId = reactCache(
  async (segmentId: string): Promise<TSurvey[]> =>
    cache(
      async () => {
        try {
          const surveysPrisma = await prisma.survey.findMany({
            where: { segmentId },
            select: selectSurvey,
          });

          const surveys: TSurvey[] = [];

          for (const surveyPrisma of surveysPrisma) {
            const transformedSurvey = transformPrismaSurvey<TSurvey>(surveyPrisma);
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
      }
    )()
);
