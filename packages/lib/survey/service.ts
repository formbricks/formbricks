import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TActionClass } from "@formbricks/types/action-classes";
import { ZOptionalNumber } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import { TEnvironment } from "@formbricks/types/environment";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TProject } from "@formbricks/types/project";
import { TSegment, ZSegmentFilters } from "@formbricks/types/segment";
import {
  TSurvey,
  TSurveyCreateInput,
  TSurveyFilterCriteria,
  TSurveyOpenTextQuestion,
  TSurveyQuestions,
  ZSurvey,
  ZSurveyCreateInput,
} from "@formbricks/types/surveys/types";
import { actionClassCache } from "../actionClass/cache";
import { getActionClasses } from "../actionClass/service";
import { cache } from "../cache";
import { segmentCache } from "../cache/segment";
import { ITEMS_PER_PAGE } from "../constants";
import { getEnvironment } from "../environment/service";
import {
  getOrganizationByEnvironmentId,
  subscribeOrganizationMembersToSurveyResponses,
} from "../organization/service";
import { structuredClone } from "../pollyfills/structuredClone";
import { capturePosthogEnvironmentEvent } from "../posthogServer";
import { projectCache } from "../project/cache";
import { getProjectByEnvironmentId } from "../project/service";
import { responseCache } from "../response/cache";
import { getIsAIEnabled } from "../utils/ai";
import { validateInputs } from "../utils/validate";
import { surveyCache } from "./cache";
import {
  buildOrderByClause,
  buildWhereClause,
  doesSurveyHasOpenTextQuestion,
  getInsightsEnabled,
  transformPrismaSurvey,
} from "./utils";

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
  redirectUrl: true,
  projectOverwrites: true,
  styling: true,
  surveyClosedMessage: true,
  singleUse: true,
  pin: true,
  resultShareKey: true,
  showLanguageSwitch: true,
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

const checkTriggersValidity = (triggers: TSurvey["triggers"], actionClasses: TActionClass[]) => {
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

const handleTriggerUpdates = (
  updatedTriggers: TSurvey["triggers"],
  currentTriggers: TSurvey["triggers"],
  actionClasses: TActionClass[]
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
            console.error(error);
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
            console.error(error);
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
  async (
    environmentId: string,
    limit?: number,
    offset?: number,
    filterCriteria?: TSurveyFilterCriteria
  ): Promise<TSurvey[]> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId], [limit, ZOptionalNumber], [offset, ZOptionalNumber]);

        try {
          const surveysPrisma = await prisma.survey.findMany({
            where: {
              environmentId,
              ...buildWhereClause(filterCriteria),
            },
            select: selectSurvey,
            orderBy: buildOrderByClause(filterCriteria?.sortBy),
            take: limit,
            skip: offset,
          });

          return surveysPrisma.map((surveyPrisma) => transformPrismaSurvey<TSurvey>(surveyPrisma));
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getSurveys-${environmentId}-${limit}-${offset}-${JSON.stringify(filterCriteria)}`],
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
            console.error(error);
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

export const getInProgressSurveyCount = reactCache(
  async (environmentId: string, filterCriteria?: TSurveyFilterCriteria): Promise<number> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);
        try {
          const surveyCount = await prisma.survey.count({
            where: {
              environmentId: environmentId,
              status: "inProgress",
              ...buildWhereClause(filterCriteria),
            },
          });

          return surveyCount;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getInProgressSurveyCount-${environmentId}-${JSON.stringify(filterCriteria)}`],
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
          updatedSegment.surveys.map((survey) => surveyCache.revalidate({ id: survey.id }));
        } catch (error) {
          console.error(error);
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

    //AI Insights
    const isAIEnabled = await getIsAIEnabled(organization);
    if (isAIEnabled) {
      if (doesSurveyHasOpenTextQuestion(data.questions ?? [])) {
        const openTextQuestions = data.questions?.filter((question) => question.type === "openText") ?? [];
        const currentSurveyOpenTextQuestions = currentSurvey.questions?.filter(
          (question) => question.type === "openText"
        );

        // find the questions that have been updated or added
        const questionsToCheckForInsights: TSurveyQuestions = [];

        for (const question of openTextQuestions) {
          const existingQuestion = currentSurveyOpenTextQuestions?.find((ques) => ques.id === question.id) as
            | TSurveyOpenTextQuestion
            | undefined;
          const isExistingQuestion = !!existingQuestion;

          if (
            isExistingQuestion &&
            question.headline.default === existingQuestion.headline.default &&
            existingQuestion.insightsEnabled !== undefined
          ) {
            continue;
          } else {
            questionsToCheckForInsights.push(question);
          }
        }

        if (questionsToCheckForInsights.length > 0) {
          const insightsEnabledValues = await Promise.all(
            questionsToCheckForInsights.map(async (question) => {
              const insightsEnabled = await getInsightsEnabled(question);

              return { id: question.id, insightsEnabled };
            })
          );

          data.questions = data.questions?.map((question) => {
            const index = insightsEnabledValues.findIndex((item) => item.id === question.id);
            if (index !== -1) {
              return {
                ...question,
                insightsEnabled: insightsEnabledValues[index].insightsEnabled,
              };
            }

            return question;
          });
        }
      }
    } else {
      // check if an existing question got changed that had insights enabled
      const insightsEnabledOpenTextQuestions = currentSurvey.questions?.filter(
        (question) => question.type === "openText" && question.insightsEnabled !== undefined
      );
      // if question headline changed, remove insightsEnabled
      for (const question of insightsEnabledOpenTextQuestions) {
        const updatedQuestion = data.questions?.find((q) => q.id === question.id);
        if (updatedQuestion && updatedQuestion.headline.default !== question.headline.default) {
          updatedQuestion.insightsEnabled = undefined;
        }
      }
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
      console.error(error);
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const deleteSurvey = async (surveyId: string) => {
  validateInputs([surveyId, ZId]);

  try {
    const deletedSurvey = await prisma.survey.delete({
      where: {
        id: surveyId,
      },
      select: selectSurvey,
    });

    if (deletedSurvey.type === "app" && deletedSurvey.segment?.isPrivate) {
      const deletedSegment = await prisma.segment.delete({
        where: {
          id: deletedSurvey.segment.id,
        },
      });

      if (deletedSegment) {
        segmentCache.revalidate({
          id: deletedSegment.id,
          environmentId: deletedSurvey.environmentId,
        });
      }
    }

    responseCache.revalidate({
      surveyId,
      environmentId: deletedSurvey.environmentId,
    });
    surveyCache.revalidate({
      id: deletedSurvey.id,
      environmentId: deletedSurvey.environmentId,
      resultShareKey: deletedSurvey.resultShareKey ?? undefined,
    });

    if (deletedSurvey.segment?.id) {
      segmentCache.revalidate({
        id: deletedSurvey.segment.id,
        environmentId: deletedSurvey.environmentId,
      });
    }

    // Revalidate public triggers by actionClassId
    deletedSurvey.triggers.forEach((trigger) => {
      surveyCache.revalidate({
        actionClassId: trigger.actionClass.id,
      });
    });

    return deletedSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(error);
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

    //AI Insights
    const isAIEnabled = await getIsAIEnabled(organization);
    if (isAIEnabled) {
      if (doesSurveyHasOpenTextQuestion(data.questions ?? [])) {
        const openTextQuestions = data.questions?.filter((question) => question.type === "openText") ?? [];
        const insightsEnabledValues = await Promise.all(
          openTextQuestions.map(async (question) => {
            const insightsEnabled = await getInsightsEnabled(question);

            return { id: question.id, insightsEnabled };
          })
        );

        data.questions = data.questions?.map((question) => {
          const index = insightsEnabledValues.findIndex((item) => item.id === question.id);
          if (index !== -1) {
            return {
              ...question,
              insightsEnabled: insightsEnabledValues[index].insightsEnabled,
            };
          }

          return question;
        });
      }
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
      await subscribeOrganizationMembersToSurveyResponses(survey.id, createdBy);
    }

    await capturePosthogEnvironmentEvent(survey.environmentId, "survey created", {
      surveyId: survey.id,
      surveyType: survey.type,
    });

    return transformedSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(error);
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const copySurveyToOtherEnvironment = async (
  environmentId: string,
  surveyId: string,
  targetEnvironmentId: string,
  userId: string
) => {
  validateInputs([environmentId, ZId], [surveyId, ZId], [targetEnvironmentId, ZId], [userId, ZId]);

  try {
    const isSameEnvironment = environmentId === targetEnvironmentId;

    // Fetch required resources
    const [existingEnvironment, existingProject, existingSurvey] = await Promise.all([
      getEnvironment(environmentId),
      getProjectByEnvironmentId(environmentId),
      getSurvey(surveyId),
    ]);

    if (!existingEnvironment) throw new ResourceNotFoundError("Environment", environmentId);
    if (!existingProject) throw new ResourceNotFoundError("Project", environmentId);
    if (!existingSurvey) throw new ResourceNotFoundError("Survey", surveyId);

    let targetEnvironment: TEnvironment | null = null;
    let targetProject: TProject | null = null;

    if (isSameEnvironment) {
      targetEnvironment = existingEnvironment;
      targetProject = existingProject;
    } else {
      [targetEnvironment, targetProject] = await Promise.all([
        getEnvironment(targetEnvironmentId),
        getProjectByEnvironmentId(targetEnvironmentId),
      ]);

      if (!targetEnvironment) throw new ResourceNotFoundError("Environment", targetEnvironmentId);
      if (!targetProject) throw new ResourceNotFoundError("Project", targetEnvironmentId);
    }

    const {
      environmentId: _,
      createdBy,
      id: existingSurveyId,
      createdAt,
      updatedAt,
      ...restExistingSurvey
    } = existingSurvey;
    const hasLanguages = existingSurvey.languages && existingSurvey.languages.length > 0;

    // Prepare survey data
    const surveyData: Prisma.SurveyCreateInput = {
      ...restExistingSurvey,
      id: createId(),
      name: `${existingSurvey.name} (copy)`,
      type: existingSurvey.type,
      status: "draft",
      welcomeCard: structuredClone(existingSurvey.welcomeCard),
      questions: structuredClone(existingSurvey.questions),
      endings: structuredClone(existingSurvey.endings),
      variables: structuredClone(existingSurvey.variables),
      hiddenFields: structuredClone(existingSurvey.hiddenFields),
      languages: hasLanguages
        ? {
            create: existingSurvey.languages.map((surveyLanguage) => ({
              language: {
                connectOrCreate: {
                  where: {
                    projectId_code: { code: surveyLanguage.language.code, projectId: targetProject.id },
                  },
                  create: {
                    code: surveyLanguage.language.code,
                    alias: surveyLanguage.language.alias,
                    projectId: targetProject.id,
                  },
                },
              },
              default: surveyLanguage.default,
              enabled: surveyLanguage.enabled,
            })),
          }
        : undefined,
      triggers: {
        create: existingSurvey.triggers.map((trigger): Prisma.SurveyTriggerCreateWithoutSurveyInput => {
          const baseActionClassData = {
            name: trigger.actionClass.name,
            environment: { connect: { id: targetEnvironmentId } },
            description: trigger.actionClass.description,
            type: trigger.actionClass.type,
          };

          if (isSameEnvironment) {
            return {
              actionClass: { connect: { id: trigger.actionClass.id } },
            };
          } else if (trigger.actionClass.type === "code") {
            return {
              actionClass: {
                connectOrCreate: {
                  where: {
                    key_environmentId: { key: trigger.actionClass.key!, environmentId: targetEnvironmentId },
                  },
                  create: {
                    ...baseActionClassData,
                    key: trigger.actionClass.key,
                  },
                },
              },
            };
          } else {
            return {
              actionClass: {
                connectOrCreate: {
                  where: {
                    name_environmentId: {
                      name: trigger.actionClass.name,
                      environmentId: targetEnvironmentId,
                    },
                  },
                  create: {
                    ...baseActionClassData,
                    noCodeConfig: trigger.actionClass.noCodeConfig
                      ? structuredClone(trigger.actionClass.noCodeConfig)
                      : undefined,
                  },
                },
              },
            };
          }
        }),
      },
      environment: {
        connect: {
          id: targetEnvironmentId,
        },
      },
      creator: {
        connect: {
          id: userId,
        },
      },
      surveyClosedMessage: existingSurvey.surveyClosedMessage
        ? structuredClone(existingSurvey.surveyClosedMessage)
        : Prisma.JsonNull,
      singleUse: existingSurvey.singleUse ? structuredClone(existingSurvey.singleUse) : Prisma.JsonNull,
      projectOverwrites: existingSurvey.projectOverwrites
        ? structuredClone(existingSurvey.projectOverwrites)
        : Prisma.JsonNull,
      styling: existingSurvey.styling ? structuredClone(existingSurvey.styling) : Prisma.JsonNull,
      segment: undefined,
      followUps: {
        createMany: {
          data: existingSurvey.followUps.map((followUp) => ({
            name: followUp.name,
            trigger: followUp.trigger,
            action: followUp.action,
          })),
        },
      },
    };

    // Handle segment
    if (existingSurvey.segment) {
      if (existingSurvey.segment.isPrivate) {
        surveyData.segment = {
          create: {
            title: surveyData.id!,
            isPrivate: true,
            filters: existingSurvey.segment.filters,
            environment: { connect: { id: targetEnvironmentId } },
          },
        };
      } else if (isSameEnvironment) {
        surveyData.segment = { connect: { id: existingSurvey.segment.id } };
      } else {
        const existingSegmentInTargetEnvironment = await prisma.segment.findFirst({
          where: {
            title: existingSurvey.segment.title,
            isPrivate: false,
            environmentId: targetEnvironmentId,
          },
        });

        surveyData.segment = {
          create: {
            title: existingSegmentInTargetEnvironment
              ? `${existingSurvey.segment.title}-${Date.now()}`
              : existingSurvey.segment.title,
            isPrivate: false,
            filters: existingSurvey.segment.filters,
            environment: { connect: { id: targetEnvironmentId } },
          },
        };
      }
    }

    const targetProjectLanguageCodes = targetProject.languages.map((language) => language.code);
    const newSurvey = await prisma.survey.create({
      data: surveyData,
      select: selectSurvey,
    });

    // Identify newly created action classes
    const newActionClasses = newSurvey.triggers.map((trigger) => trigger.actionClass);

    // Revalidate cache only for newly created action classes
    for (const actionClass of newActionClasses) {
      actionClassCache.revalidate({
        environmentId: actionClass.environmentId,
        name: actionClass.name,
        id: actionClass.id,
      });
    }

    let newLanguageCreated = false;
    if (existingSurvey.languages && existingSurvey.languages.length > 0) {
      const targetLanguageCodes = newSurvey.languages.map((lang) => lang.language.code);
      newLanguageCreated = targetLanguageCodes.length > targetProjectLanguageCodes.length;
    }

    // Invalidate caches
    if (newLanguageCreated) {
      projectCache.revalidate({ id: targetProject.id, environmentId: targetEnvironmentId });
    }

    surveyCache.revalidate({
      id: newSurvey.id,
      environmentId: newSurvey.environmentId,
      resultShareKey: newSurvey.resultShareKey ?? undefined,
    });

    existingSurvey.triggers.forEach((trigger) => {
      surveyCache.revalidate({
        actionClassId: trigger.actionClass.id,
      });
    });

    if (newSurvey.segment) {
      segmentCache.revalidate({
        id: newSurvey.segment.id,
        environmentId: newSurvey.environmentId,
      });
    }

    return newSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(error);
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
      segment.surveys.map((survey) => surveyCache.revalidate({ id: survey.id }));
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
