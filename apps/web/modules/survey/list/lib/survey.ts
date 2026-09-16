import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import {
  linkedToDesiredEmbeddedFields,
  toLegacyEmbeddedFields,
} from "@formbricks/types/embedded-data-mapping";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyFilterCriteria } from "@formbricks/types/surveys/types";
import { reconcileEmbeddedData } from "@/lib/embedded-data/reconcile";
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
      // ENG-3228: the copy follows the source's ROWS, not its legacy columns — the columns cannot
      // say that a field is a link to the workspace library, so reading them localized every shared
      // field a survey had. Selected with the row's ownership (`key`) and id so
      // `planCopiedEmbeddedFields` can decide per field whether to re-link it or clone it.
      embeddedDataLinks: {
        select: {
          storageKey: true,
          embeddedData: {
            select: {
              id: true,
              key: true,
              name: true,
              source: true,
              dataType: true,
              defaultValue: true,
              locked: true,
            },
          },
        },
        orderBy: [{ order: "asc" }, { storageKey: "asc" }],
      },
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

/** The source survey's Embedded Data links, exactly as {@link getExistingSurvey} selects them. */
type TSourceEmbeddedLinks = NonNullable<Awaited<ReturnType<typeof getExistingSurvey>>>["embeddedDataLinks"];

/**
 * What the copy's Embedded Data should be, one entry per field the source survey has (ENG-3228).
 *
 * The three cases, and why they differ:
 *
 * - **A local field** is the survey's own, so the copy gets its own — same definition, no library
 *   link. This is what every copy did to every field before the rows existed.
 * - **A shared field, same workspace.** The library row is right there, so the copy links the same
 *   row under the same storage key and the two surveys go on sharing one definition.
 * - **A shared field, another workspace.** Definitions do not cross a workspace boundary, so the
 *   copy looks for the same field in the target's library — same `key`, `source` and `dataType`,
 *   because a `plan` that is ingested text over here and computed over there is a different field
 *   wearing the same name — and links it when it finds one. This mirrors what the segment handling
 *   a few lines below already does for a public segment of the same title.
 *
 * When there is no match the field is **localized**: the copy gets a private definition rather than
 * losing the field. It takes the library `key` as its name, not the display label, because a local
 * field's name is the legacy variable name or hidden field id the copy's columns will carry, and a
 * label like `Plan tier` is not a legal one. The storage key is preserved either way — it is the
 * address recall tokens and logic operands inside the copied blocks already point at.
 */
const planCopiedEmbeddedFields = async (
  links: TSourceEmbeddedLinks,
  { isSameWorkspace, targetWorkspaceId }: { isSameWorkspace: boolean; targetWorkspaceId: string }
): Promise<TLinkedEmbeddedField[]> => {
  const sharedKeys = links.map((link) => link.embeddedData.key).filter((key) => key !== null);

  const targetLibrary =
    !isSameWorkspace && sharedKeys.length > 0
      ? await prisma.embeddedData.findMany({
          where: { workspaceId: targetWorkspaceId, surveyId: null, key: { in: sharedKeys } },
          select: {
            id: true,
            key: true,
            name: true,
            source: true,
            dataType: true,
            defaultValue: true,
            locked: true,
          },
        })
      : [];
  const librarySignature = (row: { key: string | null; source: string; dataType: string }): string =>
    `${row.key}|${row.source}|${row.dataType}`;
  const targetBySignature = new Map(targetLibrary.map((row) => [librarySignature(row), row]));

  /** The library row the copy should link for this field, or nothing when it has to own one. */
  const sharedTargetFor = (row: TSourceEmbeddedLinks[number]["embeddedData"]) => {
    if (row.key === null) return undefined;
    return isSameWorkspace ? row : targetBySignature.get(librarySignature(row));
  };

  return links.map(({ storageKey, embeddedData: row }) => {
    const shared = sharedTargetFor(row);

    if (shared) {
      return {
        field: {
          id: shared.id,
          key: shared.key,
          name: shared.name,
          source: shared.source,
          dataType: shared.dataType,
          defaultValue: shared.defaultValue,
          locked: shared.locked,
        },
        link: { storageKey },
      };
    }

    return {
      field: {
        key: null,
        name: row.key ?? row.name,
        source: row.source,
        dataType: row.dataType,
        defaultValue: row.defaultValue,
        locked: row.locked,
      },
      link: { storageKey },
    };
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

    // The relation is the copy's Embedded Data plan, not a column to clone: `Survey` owns a relation
    // by this name, so spreading it into `SurveyCreateInput` would be a nested relation write.
    const { embeddedDataLinks, ...restExistingSurvey } = existingSurvey;
    const hasLanguages = existingSurvey.languages && existingSurvey.languages.length > 0;
    const t = await getTranslate();

    const copiedEmbeddedFields = await planCopiedEmbeddedFields(embeddedDataLinks, {
      isSameWorkspace,
      targetWorkspaceId: targetWorkspace.id,
    });
    // Derived from the plan rather than cloned from the source, so a localized shared field lands in
    // the columns under the same name the copy's row holds.
    const copiedLegacyColumns = toLegacyEmbeddedFields(
      linkedToDesiredEmbeddedFields(copiedEmbeddedFields),
      existingSurvey.hiddenFields
    );

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
      variables: copiedLegacyColumns.variables,
      hiddenFields: copiedLegacyColumns.hiddenFields,
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

        // ENG-1978: the copy carries the source survey's Embedded Data, so the new survey needs its
        // own rows and links. ENG-3228: from the plan built off the source's ROWS, which is what
        // lets a shared field stay shared — reading the legacy columns here silently localized every
        // one of them. `workspaceId` is read off the created row rather than the function's
        // `workspaceId` argument, which is the SOURCE workspace — a copy into a different workspace
        // must define its fields there.
        await reconcileEmbeddedData(tx, {
          surveyId: createdSurvey.id,
          workspaceId: createdSurvey.workspaceId,
          patch: { embeddedFields: copiedEmbeddedFields },
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

/**
 * Every survey in the workspace, archived ones included. Filter-independent, so the list can tell an
 * empty workspace (onboarding) from a filter that matched nothing — and a count rather than a flag so
 * an optimistic delete can decrement it before the server answers.
 */
export const getWorkspaceSurveyCount = reactCache(async (workspaceId: string): Promise<number> => {
  validateInputs([workspaceId, z.cuid2()]);
  try {
    return await prisma.survey.count({ where: { workspaceId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error counting the workspace's surveys");
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});
