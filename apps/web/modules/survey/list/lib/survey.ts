import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyFilterCriteria } from "@formbricks/types/surveys/types";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { checkForInvalidMediaInBlocks } from "@/lib/survey/utils";
import { validateInputs } from "@/lib/utils/validate";
import { getTranslate } from "@/lingodotdev/server";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { getQuotas } from "@/modules/ee/quotas/lib/quotas";
import { buildWhereClause } from "@/modules/survey/lib/utils";
import { doesWorkspaceExist, getWorkspaceWithLanguages } from "@/modules/survey/list/lib/workspace";
import type { TWorkspaceWithLanguages } from "@/modules/survey/list/types/surveys";

const getExistingSurvey = async (surveyId: string) => {
  return await prisma.survey.findUnique({
    where: {
      id: surveyId,
    },
    select: {
      name: true,
      type: true,
      languages: {
        select: {
          default: true,
          enabled: true,
          language: {
            select: {
              code: true,
              alias: true,
            },
          },
        },
      },
      welcomeCard: true,
      questions: true,
      blocks: true,
      endings: true,
      variables: true,
      hiddenFields: true,
      surveyClosedMessage: true,
      singleUse: true,
      workspaceOverwrites: true,
      styling: true,
      segment: true,
      followUps: true,
      displayOption: true,
      recontactDays: true,
      displayLimit: true,
      triggers: {
        select: {
          actionClass: {
            select: {
              id: true,
              name: true,
              description: true,
              type: true,
              key: true,
              noCodeConfig: true,
            },
          },
        },
      },
    },
  });
};

export const copySurveyToOtherWorkspace = async (
  workspaceId: string,
  surveyId: string,
  targetWorkspaceId: string,
  userId: string
) => {
  try {
    const isSameWorkspace = workspaceId === targetWorkspaceId;

    // Fetch required resources
    const [existingWorkspaceCheck, existingWorkspace, existingSurvey, existingQuotas, organization] =
      await Promise.all([
        doesWorkspaceExist(workspaceId),
        getWorkspaceWithLanguages(workspaceId),
        getExistingSurvey(surveyId),
        getQuotas(surveyId),
        getOrganizationByWorkspaceId(workspaceId),
      ]);

    if (!existingWorkspaceCheck) throw new ResourceNotFoundError("Workspace", workspaceId);
    if (!existingWorkspace) throw new ResourceNotFoundError("Workspace", workspaceId);
    if (!existingSurvey) throw new ResourceNotFoundError("Survey", surveyId);
    if (!organization) throw new ResourceNotFoundError("Organization", workspaceId);

    const isQuotasAllowed = await getIsQuotasEnabled(organization.id);

    let targetWorkspace: TWorkspaceWithLanguages | null = null;

    if (isSameWorkspace) {
      targetWorkspace = existingWorkspace;
    } else {
      [, targetWorkspace] = await Promise.all([
        doesWorkspaceExist(targetWorkspaceId),
        getWorkspaceWithLanguages(targetWorkspaceId),
      ]);

      if (!targetWorkspace) throw new ResourceNotFoundError("Workspace", targetWorkspaceId);
    }

    // Fetch existing action classes in target workspace for name conflict checks
    const existingActionClasses = !isSameWorkspace
      ? await prisma.actionClass.findMany({
          where: { workspaceId: targetWorkspace.id },
          select: { name: true, type: true, key: true, noCodeConfig: true, id: true },
        })
      : [];

    const { ...restExistingSurvey } = existingSurvey;
    const hasLanguages = existingSurvey.languages && existingSurvey.languages.length > 0;
    const t = await getTranslate();

    // Prepare survey data
    const surveyData: Prisma.SurveyCreateInput = {
      ...restExistingSurvey,
      id: createId(),
      name: `${existingSurvey.name} ${t("common.duplicate_copy")}`,
      type: existingSurvey.type,
      status: "draft",
      welcomeCard: structuredClone(existingSurvey.welcomeCard),
      blocks: structuredClone(existingSurvey.blocks),
      endings: structuredClone(existingSurvey.endings),
      variables: structuredClone(existingSurvey.variables),
      hiddenFields: structuredClone(existingSurvey.hiddenFields),
      languages: hasLanguages
        ? {
            create: existingSurvey.languages.map((surveyLanguage) => ({
              language: {
                connectOrCreate: {
                  where: {
                    workspaceId_code: { code: surveyLanguage.language.code, workspaceId: targetWorkspace.id },
                  },
                  create: {
                    code: surveyLanguage.language.code,
                    alias: surveyLanguage.language.alias,
                    workspaceId: targetWorkspace.id,
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
          //check if an action class with same config already exists
          if (trigger.actionClass.type === "code") {
            const existingActionClass = existingActionClasses.find(
              (ac) => ac.key === trigger.actionClass.key
            );

            if (existingActionClass) {
              return {
                actionClass: { connect: { id: existingActionClass.id } },
              };
            }
          } else if (trigger.actionClass.type === "noCode") {
            const existingActionClass = existingActionClasses.find(
              (ac) => JSON.stringify(ac.noCodeConfig) === JSON.stringify(trigger.actionClass.noCodeConfig)
            );

            if (existingActionClass) {
              return {
                actionClass: { connect: { id: existingActionClass.id } },
              };
            }
          }

          const existingActionClassNames = new Set(existingActionClasses.map((ac) => ac.name));

          // Check if an action class with the same name but different type already exists
          const hasNameConflict = !isSameWorkspace && existingActionClassNames.has(trigger.actionClass.name);

          let modifiedName = trigger.actionClass.name;
          if (hasNameConflict) {
            // Find a unique name by appending (copy), (copy 2), (copy 3), etc.
            let copyNumber = 1;
            let candidateName = `${trigger.actionClass.name} ${t("common.duplicate_copy")}`;

            while (existingActionClassNames.has(candidateName)) {
              copyNumber++;
              candidateName = `${trigger.actionClass.name} ${t("common.duplicate_copy_number", { copyNumber })}`;
            }

            modifiedName = candidateName;
          }

          const baseActionClassData = {
            name: modifiedName,
            workspace: { connect: { id: targetWorkspace.id } },
            description: trigger.actionClass.description,
            type: trigger.actionClass.type,
          };

          if (isSameWorkspace) {
            return {
              actionClass: { connect: { id: trigger.actionClass.id } },
            };
          } else if (trigger.actionClass.type === "code") {
            return {
              actionClass: {
                connectOrCreate: {
                  where: {
                    key_workspaceId: {
                      key: trigger.actionClass.key!,
                      workspaceId: targetWorkspace.id,
                    },
                  },
                  create: {
                    ...baseActionClassData,
                    key: trigger.actionClass.key,
                  },
                },
              },
            };
          } else {
            if (hasNameConflict) {
              return {
                actionClass: {
                  create: {
                    ...baseActionClassData,
                    noCodeConfig: trigger.actionClass.noCodeConfig
                      ? structuredClone(trigger.actionClass.noCodeConfig)
                      : undefined,
                  },
                },
              };
            }
            return {
              actionClass: {
                connectOrCreate: {
                  where: {
                    name_workspaceId: {
                      name: trigger.actionClass.name,
                      workspaceId: targetWorkspace.id,
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
      workspace: {
        connect: {
          id: targetWorkspace!.id,
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
      workspaceOverwrites: existingSurvey.workspaceOverwrites
        ? structuredClone(existingSurvey.workspaceOverwrites)
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
      quotas: {
        createMany: {
          data:
            isQuotasAllowed && existingQuotas.length > 0
              ? existingQuotas.map((quota) => ({
                  name: quota.name,
                  logic: quota.logic,
                  limit: quota.limit,
                  action: quota.action,
                  endingCardId: quota.endingCardId,
                  countPartialSubmissions: quota.countPartialSubmissions,
                }))
              : [],
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
            workspace: { connect: { id: targetWorkspace!.id } },
          },
        };
      } else if (isSameWorkspace) {
        surveyData.segment = { connect: { id: existingSurvey.segment.id } };
      } else {
        const existingSegmentInTargetEnvironment = await prisma.segment.findFirst({
          where: {
            title: existingSurvey.segment.title,
            isPrivate: false,
            workspaceId: targetWorkspace.id,
          },
        });

        surveyData.segment = {
          create: {
            title: existingSegmentInTargetEnvironment
              ? `${existingSurvey.segment.title}-${Date.now()}`
              : existingSurvey.segment.title,
            isPrivate: false,
            filters: existingSurvey.segment.filters,
            workspace: { connect: { id: targetWorkspace!.id } },
          },
        };
      }
    }

    if (surveyData.blocks) {
      const result = checkForInvalidMediaInBlocks(surveyData.blocks as unknown as TSurveyBlock[]);
      if (!result.ok) {
        throw new InvalidInputError(result.error.message);
      }
    }

    const newSurvey = await prisma.survey.create({
      data: surveyData,
      select: {
        id: true,
        workspaceId: true,
        segment: {
          select: {
            id: true,
          },
        },
        triggers: {
          select: {
            actionClass: {
              select: {
                id: true,
                name: true,
                workspaceId: true,
              },
            },
          },
        },
        languages: {
          select: {
            language: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    return newSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error copying survey to other workspace");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

/** Count surveys in a workspace, optionally with the same filter as getSurveys (so total matches list). */
export const getSurveyCount = reactCache(
  async (workspaceId: string, filterCriteria?: TSurveyFilterCriteria): Promise<number> => {
    validateInputs([workspaceId, z.cuid2()]);
    try {
      const surveyCount = await prisma.survey.count({
        where: {
          workspaceId,
          ...buildWhereClause(filterCriteria),
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
  }
);

/** Whether the workspace has any archived (soft-deleted) surveys. Drives the "Archived" filter option. */
export const hasArchivedSurveys = reactCache(async (workspaceId: string): Promise<boolean> => {
  validateInputs([workspaceId, z.cuid2()]);
  try {
    const archivedSurvey = await prisma.survey.findFirst({
      where: { workspaceId, archivedAt: { not: null } },
      select: { id: true },
    });

    return archivedSurvey !== null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error checking for archived surveys");
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});
