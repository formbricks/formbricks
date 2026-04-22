import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSegment, ZSegmentFilters } from "@formbricks/types/segment";
import { TSurvey, TSurveyCreateInput, ZSurvey, ZSurveyCreateInput } from "@formbricks/types/surveys/types";
import {
  getOrganizationByWorkspaceId,
  subscribeOrganizationMembersToSurveyResponses,
} from "@/lib/organization/service";
import { handleTriggerUpdates } from "@/modules/survey/lib/trigger-updates";
import {
  isSurveySchedulingDue,
  normalizeSurveyScheduling,
  reconcileDueSurveySchedules,
} from "@/modules/survey/scheduling/lib/survey-scheduling";
import { getActionClasses } from "../actionClass/service";
import { ITEMS_PER_PAGE } from "../constants";
import { validateInputs } from "../utils/validate";
import {
  checkForInvalidImagesInQuestions,
  checkForInvalidMediaInBlocks,
  stripIsDraftFromBlocks,
  transformPrismaSurvey,
  validateMediaAndPrepareBlocks,
} from "./utils";

export const selectSurvey = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  type: true,
  workspaceId: true,
  createdBy: true,
  status: true,
  welcomeCard: true,
  questions: true,
  blocks: true,
  endings: true,
  hiddenFields: true,
  variables: true,
  displayOption: true,
  recontactDays: true,
  displayLimit: true,
  autoClose: true,
  delay: true,
  displayPercentage: true,
  autoComplete: true,
  publishOn: true,
  closeOn: true,
  isVerifyEmailEnabled: true,
  isSingleResponsePerEmailEnabled: true,
  isBackButtonHidden: true,
  isAutoProgressingEnabled: true,
  isCaptureIpEnabled: true,
  redirectUrl: true,
  workspaceOverwrites: true,
  styling: true,
  surveyClosedMessage: true,
  singleUse: true,
  pin: true,
  showLanguageSwitch: true,
  recaptcha: true,
  metadata: true,
  customHeadScripts: true,
  customHeadScriptsMode: true,
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
          workspaceId: true,
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
          workspaceId: true,
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
  slug: true,
} satisfies Prisma.SurveySelect;

const reconcilePersistedSurveySchedulingIfDue = async ({
  logSource,
  survey,
  workspaceId,
}: {
  logSource: "survey-create" | "survey-update";
  survey: TSurvey;
  workspaceId: string;
}): Promise<TSurvey> => {
  const now = new Date();

  if (!isSurveySchedulingDue(survey, now)) {
    return survey;
  }

  const reconciliationResult = await reconcileDueSurveySchedules({
    logContext: {
      source: logSource,
      surveyId: survey.id,
      workspaceId,
    },
    now,
    surveyId: survey.id,
  });

  if (!reconciliationResult.surveyUpdated) {
    return survey;
  }

  const reconciledSurvey = await prisma.survey.findUnique({
    where: { id: survey.id },
    select: selectSurvey,
  });

  if (!reconciledSurvey) {
    throw new ResourceNotFoundError("Survey", survey.id);
  }

  return transformPrismaSurvey<TSurvey>(reconciledSurvey);
};

export const getSurvey = reactCache(async (surveyId: string): Promise<TSurvey | null> => {
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
});

export const getSurveysByActionClassId = reactCache(
  async (actionClassId: string, page?: number): Promise<TSurvey[]> => {
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
  }
);

export const getSurveys = reactCache(
  async (workspaceId: string, limit?: number, offset?: number): Promise<TSurvey[]> => {
    validateInputs([workspaceId, ZId], [limit, ZOptionalNumber], [offset, ZOptionalNumber]);

    try {
      const surveysPrisma = await prisma.survey.findMany({
        where: {
          workspaceId,
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
  }
);

export const getSurveyCount = reactCache(async (workspaceId: string): Promise<number> => {
  validateInputs([workspaceId, ZId]);
  try {
    const surveyCount = await prisma.survey.count({
      where: {
        workspaceId,
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
});

export const updateSurveyInternal = async (
  updatedSurvey: TSurvey,
  skipValidation = false
): Promise<TSurvey> => {
  if (!skipValidation) {
    validateInputs([updatedSurvey, ZSurvey]);
  }

  try {
    const surveyId = updatedSurvey.id;
    let data: any = {};

    const actionClasses = await getActionClasses(updatedSurvey.workspaceId);
    const currentSurvey = await getSurvey(surveyId);

    if (!currentSurvey) {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    const { triggers, segment, questions, languages, type, followUps, ...surveyData } = updatedSurvey;

    if (!skipValidation) {
      checkForInvalidImagesInQuestions(questions);
    }

    // Add blocks media validation
    if (!skipValidation && updatedSurvey.blocks && updatedSurvey.blocks.length > 0) {
      const blocksValidation = checkForInvalidMediaInBlocks(updatedSurvey.blocks);
      if (!blocksValidation.ok) {
        throw new InvalidInputError(blocksValidation.error.message);
      }
    }

    if (languages) {
      // Process languages update logic here
      // Extract currentLanguageIds and updatedLanguageIds
      const currentLanguageIds = currentSurvey.languages
        ? currentSurvey.languages.map((l) => l.language.id)
        : [];
      const updatedLanguageIds =
        languages.length > 0 ? updatedSurvey.languages.map((l) => l.language.id) : [];
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
        if (!skipValidation && !parsedFilters.success) {
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

          await prisma.segment.update({
            where: { id: segment.id },
            data: updatedInput,
            select: {
              surveys: { select: { id: true } },
              id: true,
            },
          });
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
    } else if (type === "app") {
      if (!currentSurvey.segment) {
        const workspaceId = updatedSurvey.workspaceId;
        await prisma.survey.update({
          where: {
            id: surveyId,
          },
          data: {
            segment: {
              connectOrCreate: {
                where: {
                  workspaceId_title: {
                    workspaceId,
                    title: surveyId,
                  },
                },
                create: {
                  title: surveyId,
                  isPrivate: true,
                  filters: [],
                  workspace: {
                    connect: {
                      id: workspaceId,
                    },
                  },
                },
              },
            },
          },
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
                  id: followUp.id,
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

    // Strip isDraft from elements before saving
    if (updatedSurvey.blocks && updatedSurvey.blocks.length > 0) {
      data.blocks = stripIsDraftFromBlocks(updatedSurvey.blocks);
    }

    const normalizedScheduling = normalizeSurveyScheduling({
      currentStatus: currentSurvey.status,
      closeOn: surveyData.closeOn,
      publishOn: surveyData.publishOn,
      status: updatedSurvey.status,
    });

    surveyData.updatedAt = new Date();
    surveyData.publishOn = normalizedScheduling.publishOn;
    surveyData.closeOn = normalizedScheduling.closeOn;

    data = {
      ...surveyData,
      ...data,
      type,
    };

    delete data.createdBy;
    const persistedSurvey = await prisma.survey.update({
      where: { id: surveyId },
      data,
      select: selectSurvey,
    });

    return await reconcilePersistedSurveySchedulingIfDue({
      logSource: "survey-update",
      survey: transformPrismaSurvey<TSurvey>(persistedSurvey),
      workspaceId: updatedSurvey.workspaceId,
    });
  } catch (error) {
    logger.error(error, "Error updating survey");
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const updateSurvey = async (updatedSurvey: TSurvey): Promise<TSurvey> => {
  return updateSurveyInternal(updatedSurvey);
};

// Draft update without validation
export const updateSurveyDraft = async (updatedSurvey: TSurvey): Promise<TSurvey> => {
  return updateSurveyInternal(updatedSurvey, true);
};

const attachSurveyCreatorToCreateData = (
  data: Omit<Prisma.SurveyCreateInput, "workspace">,
  createdBy?: string | null
): Omit<Prisma.SurveyCreateInput, "workspace"> => {
  if (!createdBy) {
    return data;
  }

  return {
    ...data,
    creator: {
      connect: {
        id: createdBy,
      },
    },
  };
};

const attachSurveyFollowUpsToCreateData = (
  data: Omit<Prisma.SurveyCreateInput, "workspace">,
  followUps?: TSurveyCreateInput["followUps"]
): Omit<Prisma.SurveyCreateInput, "workspace"> => {
  const { followUps: _, ...dataWithoutFollowUps } = data;

  if (!followUps?.length) {
    return dataWithoutFollowUps;
  }

  return {
    ...dataWithoutFollowUps,
    followUps: {
      create: followUps.map((followUp) => ({
        name: followUp.name,
        trigger: followUp.trigger,
        action: followUp.action,
      })),
    },
  };
};

const validateSurveyCreateDataMedia = (
  data: Omit<Prisma.SurveyCreateInput, "workspace">
): Omit<Prisma.SurveyCreateInput, "workspace"> => {
  if (data.questions) {
    checkForInvalidImagesInQuestions(data.questions);
  }

  if (data.blocks?.length) {
    return {
      ...data,
      blocks: validateMediaAndPrepareBlocks(data.blocks),
    };
  }

  return data;
};

export const createSurvey = async (workspaceId: string, surveyBody: TSurveyCreateInput): Promise<TSurvey> => {
  const [parsedWorkspaceId, parsedSurveyBody] = validateInputs(
    [workspaceId, ZId],
    [surveyBody, ZSurveyCreateInput]
  );

  try {
    const { createdBy, languages, ...restSurveyBody } = parsedSurveyBody;
    const normalizedCloseOn = restSurveyBody.closeOn instanceof Date ? restSurveyBody.closeOn : null;
    const normalizedPublishOn = restSurveyBody.publishOn instanceof Date ? restSurveyBody.publishOn : null;

    const actionClasses = await getActionClasses(parsedWorkspaceId);

    const baseData: Omit<Prisma.SurveyCreateInput, "workspace"> = {
      ...restSurveyBody,
      ...normalizeSurveyScheduling({
        closeOn: normalizedCloseOn,
        publishOn: normalizedPublishOn,
        status: restSurveyBody.status ?? "draft",
      }),
      // @ts-expect-error - languages would be undefined in case of empty array
      languages: languages?.length ? languages : undefined,
      triggers: restSurveyBody.triggers
        ? handleTriggerUpdates(restSurveyBody.triggers, [], actionClasses)
        : undefined,
      attributeFilters: undefined,
    };
    const data = validateSurveyCreateDataMedia(
      attachSurveyFollowUpsToCreateData(
        attachSurveyCreatorToCreateData(baseData, createdBy),
        restSurveyBody.followUps
      )
    );

    const organization = await getOrganizationByWorkspaceId(parsedWorkspaceId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", null);
    }

    const survey = await prisma.survey.create({
      data: {
        ...data,
        workspace: {
          connect: {
            id: parsedWorkspaceId,
          },
        },
      },
      select: selectSurvey,
    });

    // if the survey created is an "app" survey, we also create a private segment for it.
    if (survey.type === "app") {
      const newSegment = await prisma.segment.create({
        data: {
          title: survey.id,
          filters: [],
          isPrivate: true,
          workspace: {
            connect: {
              id: parsedWorkspaceId,
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

    const reconciledSurvey = await reconcilePersistedSurveySchedulingIfDue({
      logSource: "survey-create",
      survey: transformedSurvey,
      workspaceId: parsedWorkspaceId,
    });

    if (createdBy) {
      await subscribeOrganizationMembersToSurveyResponses(reconciledSurvey.id, createdBy, organization.id);
    }

    return reconciledSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error creating survey");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

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
      await prisma.segment.delete({
        where: {
          id: currentSurveySegment.id,
        },
        select: {
          surveys: {
            select: {
              id: true,
            },
          },
        },
      });
    }

    let surveySegment: TSegment | null = null;
    if (prismaSurvey.segment) {
      surveySegment = {
        ...prismaSurvey.segment,
        surveys: prismaSurvey.segment.surveys.map((survey) => survey.id),
      };
    }

    const modifiedSurvey = {
      ...prismaSurvey,
      segment: surveySegment,
      customHeadScriptsMode: prismaSurvey.customHeadScriptsMode,
    };

    return modifiedSurvey as TSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getSurveysBySegmentId = reactCache(async (segmentId: string): Promise<TSurvey[]> => {
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
});
