import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import {
  DatabaseError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "@formbricks/types/errors";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyFilterCriteria } from "@formbricks/types/surveys/types";
import { reconcileEmbeddedData } from "@/lib/embedded-data/reconcile";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { checkForInvalidMediaInBlocks } from "@/lib/survey/utils";
import type { TSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { resolveSurveyCreationFacts } from "@/lib/survey/visibility/creation";
import { WorkspaceSurveyLimitError, assertWorkspaceSurveyLimit } from "@/lib/survey/visibility/limit";
import { type TSurveyVisibilityFilter, buildSurveyAccessWhere } from "@/lib/survey/visibility/predicate";
import { validateInputs } from "@/lib/utils/validate";
import { getTranslate } from "@/lingodotdev/server";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { getQuotas } from "@/modules/ee/quotas/lib/quotas";
import { assertCanWriteCustomHeadScripts } from "@/modules/survey/lib/custom-head-scripts-permission";
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
      // Behaviour, presentation and security settings. The copy is built by spreading whatever this
      // select returns, so a settings column missing here is not reset on purpose — it is never read,
      // and the new row silently falls back to its database default. That is how duplicates lost PIN
      // protection, response limits and redirect URLs (ENG-2144), and the recontact fields before
      // that (#6802). Add new Survey settings columns here; `survey.test.ts` fails if you forget.
      redirectUrl: true,
      autoComplete: true,
      autoClose: true,
      delay: true,
      displayPercentage: true,
      showLanguageSwitch: true,
      pin: true,
      recaptcha: true,
      isVerifyEmailEnabled: true,
      isAnonymizeResponsesEnabled: true,
      isCaptureIpEnabled: true,
      isBackButtonHidden: true,
      isAutoProgressingEnabled: true,
      metadata: true,
      customHeadScripts: true,
      customHeadScriptsMode: true,
      inlineTriggers: true,
      // `publishOn` and `closeOn` are the deliberate exceptions. The scheduler promotes a survey on
      // `paused` + publishOn <= now and closes it on `inProgress` + closeOn <= now, so a copy that
      // inherited a date already in the past would complete itself on the first tick after the user
      // publishes it. They are also normalised against each other on save, which this path bypasses.
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

      // The copy runs these scripts on the target workspace's link surveys, where no one with Manage
      // access has approved them, so carrying them over takes Manage there — as writing them would.
      await assertCanWriteCustomHeadScripts(
        { type: "user", id: userId },
        targetWorkspace.id,
        { customHeadScripts: existingSurvey.customHeadScripts },
        null
      );
    }

    // Fetch existing action classes in target workspace for name conflict checks
    const existingActionClasses = !isSameWorkspace
      ? await prisma.actionClass.findMany({
          where: { workspaceId: targetWorkspace.id },
          select: { name: true, type: true, key: true, noCodeConfig: true, id: true },
        })
      : [];

    // ENG-3282: a copy is a new survey on every count — the target workspace's cap applies, and it is
    // owned by the person copying it, with the visibility a fresh creation in the target organization
    // would get. Neither is read from the source: `getExistingSurvey` selects no visibility column.
    await assertWorkspaceSurveyLimit(targetWorkspace.id);
    const targetOrganizationId = isSameWorkspace
      ? organization.id
      : ((await getOrganizationByWorkspaceId(targetWorkspace.id))?.id ?? null);
    if (!targetOrganizationId) throw new ResourceNotFoundError("Organization", targetWorkspace.id);
    const creationFacts = await resolveSurveyCreationFacts({
      actor: { type: "user", id: userId },
      organizationId: targetOrganizationId,
    });

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
      owner: { connect: { id: userId } },
      visibility: creationFacts.visibility,
      surveyClosedMessage: existingSurvey.surveyClosedMessage
        ? structuredClone(existingSurvey.surveyClosedMessage)
        : Prisma.JsonNull,
      singleUse: existingSurvey.singleUse ? structuredClone(existingSurvey.singleUse) : Prisma.JsonNull,
      workspaceOverwrites: existingSurvey.workspaceOverwrites
        ? structuredClone(existingSurvey.workspaceOverwrites)
        : Prisma.JsonNull,
      styling: existingSurvey.styling ? structuredClone(existingSurvey.styling) : Prisma.JsonNull,
      // "replace" means "run only this survey's scripts, not the workspace's". In another workspace
      // that would silently switch off the target's own head scripts (analytics, consent), so the
      // copy keeps its scripts but adds them to the target's instead.
      customHeadScriptsMode: isSameWorkspace ? existingSurvey.customHeadScriptsMode : "add",
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

    const newSurvey = await prisma.$transaction(
      async (tx) => {
        const createdSurvey = await tx.survey.create({
          data: surveyData,
          select: {
            id: true,
            workspaceId: true,
            variables: true,
            hiddenFields: true,
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

        // ENG-1978: the copy carries the source survey's variables and hidden fields, so the new
        // survey needs its own rows. `workspaceId` is read off the created row rather than the
        // function's `workspaceId` argument, which is the SOURCE workspace — a copy into a different
        // workspace must define its fields there.
        await reconcileEmbeddedData(tx, {
          surveyId: createdSurvey.id,
          workspaceId: createdSurvey.workspaceId,
          patch: { variables: createdSurvey.variables, hiddenFields: createdSurvey.hiddenFields },
        });

        return createdSurvey;
      },
      // This create was untransacted before ENG-1978, so wrapping it introduced Prisma's 5s
      // interactive-transaction ceiling where there had been none. It is the deepest of the
      // reconcile call sites (enumerated on `getDeclaredEmbeddedFields`) — it clones blocks, endings,
      // the welcome card, variables, hidden fields, follow-ups and quotas, and resolves an action
      // class per trigger through `connectOrCreate` — so a large survey could plausibly reach it and
      // fail a copy that used to succeed. Matches the ceiling on `updateSurveyInternal` for the same
      // reason.
      { timeout: 20_000, maxWait: 10_000 }
    );

    return newSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error copying survey to other workspace");
      throw new DatabaseError(error.message);
    }
    if (error instanceof WorkspaceSurveyLimitError) {
      throw new OperationNotAllowedError("The target workspace has reached its survey limit");
    }
    throw error;
  }
};

/** Count surveys in a workspace, optionally with the same filter as getSurveys (so total matches list). */
export const getSurveyCount = reactCache(
  async (
    workspaceId: string,
    filterCriteria: TSurveyFilterCriteria | undefined,
    actorContext: TSurveyActorContext,
    visibilityFilter?: TSurveyVisibilityFilter
  ): Promise<number> => {
    validateInputs([workspaceId, z.cuid2()]);
    try {
      const { AND: filterClauses } = buildWhereClause(filterCriteria);
      const surveyCount = await prisma.survey.count({
        where: {
          workspaceId,
          // ENG-3282: the same visibility clauses as the list, so the total counts exactly the set it pages.
          AND: [
            ...(Array.isArray(filterClauses) ? filterClauses : []),
            ...buildSurveyAccessWhere(actorContext, visibilityFilter),
          ],
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

/**
 * Every survey in the workspace, archived ones included. Filter-independent, so the list can tell an
 * empty workspace (onboarding) from a filter that matched nothing — and a count rather than a flag so
 * an optimistic delete can decrement it before the server answers.
 */
export const getWorkspaceSurveyCount = reactCache(
  async (workspaceId: string, actorContext: TSurveyActorContext): Promise<number> => {
    validateInputs([workspaceId, z.cuid2()]);
    try {
      // ENG-3282: surveys this caller can read, so a restricted survey is not countable by someone who
      // cannot see it (an existence oracle otherwise).
      return await prisma.survey.count({
        where: { workspaceId, AND: buildSurveyAccessWhere(actorContext) },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error counting the workspace's surveys");
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
