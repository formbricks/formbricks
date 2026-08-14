import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import { toDesiredEmbeddedFields } from "@formbricks/types/embedded-data-mapping";
import {
  DatabaseError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "@formbricks/types/errors";
import { TBaseFilters, ZSegmentFilters } from "@formbricks/types/segment";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurvey, TSurveyCreateInput, ZSurvey, ZSurveyCreateInput } from "@formbricks/types/surveys/types";
import { reconcileEmbeddedData } from "@/lib/embedded-data/reconcile";
import { selectSurveyEmbeddedDataLinks, withInlinedEmbeddedFields } from "@/lib/embedded-data/survey-fields";
import {
  getOrganizationByWorkspaceId,
  subscribeOrganizationMembersToSurveyResponses,
} from "@/lib/organization/service";
import { getSurveyWorkspaceIdMap } from "@/modules/ee/contacts/segments/lib/segments";
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
  APP_SURVEY_TRIGGER_REQUIRED_MESSAGE,
  checkForInvalidImagesInQuestions,
  checkForInvalidMediaInBlocks,
  isAppSurveyMissingTriggersToPublish,
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
  archivedAt: true,
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
  // ENG-1837: the definitions every reader resolves through, joined and inlined by
  // `transformPrismaSurvey`. Read-only — the rows are written by `reconcileEmbeddedData`.
  embeddedDataLinks: selectSurveyEmbeddedDataLinks,
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
          // Archived surveys are hidden by default across the app.
          archivedAt: null,
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
    // Deliberately archive-inclusive. The sole consumer is the onboarding gate
    // (redirect-if-onboarding-complete.ts): a workspace whose only survey is archived has already
    // finished onboarding, so it must count > 0. Excluding archived here bounces such a user back
    // into the "create your first survey" flow on every login — a full-screen page with no route to
    // the Archived filter — while their archived survey counts down to permanent deletion.
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

    const currentSurvey = await getSurvey(surveyId);

    if (!currentSurvey) {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    // Archived surveys are read-only. This covers every write path that flows through here
    // (editor save, the summary status dropdown's server action, etc.) — not just the v3 API.
    // Archive/restore themselves bypass this guard: they write archivedAt directly, not via update.
    if (currentSurvey.archivedAt) {
      throw new InvalidInputError("This survey is archived. Restore it before editing.");
    }

    // ENG-1749: workspaceId and id are the survey's tenant anchors. Always resolve the workspace from
    // the existing survey (never the client payload), and strip workspaceId/id from the update below,
    // so an authorized editor cannot re-point their own survey into another workspace/organization.
    const actionClasses = await getActionClasses(currentSurvey.workspaceId);

    const {
      triggers,
      segment,
      questions,
      languages,
      type,
      followUps,
      workspaceId: _workspaceId,
      id: _id,
      // archivedAt is owned exclusively by the archive/restore flows; never let a survey update touch it.
      archivedAt: _archivedAt,
      // ENG-1837: `embeddedFields` is a read-only projection of the EmbeddedData tables, inlined by
      // the join below. `surveyData` is spread straight into `tx.survey.update`'s `data`, and
      // `Survey` owns relations named `embeddedData` / `embeddedDataLinks` — so leaving it in would
      // turn a read projection into a nested relation write. The rows are written by
      // `reconcileEmbeddedData` from the persisted legacy columns instead.
      embeddedFields: _embeddedFields,
      ...surveyData
    } = updatedSurvey;

    // ENG-1749 sibling: the segment block below updates/deletes by segment.id directly. Ensure the
    // segment belongs to this survey's workspace so a caller cannot mutate or delete another
    // tenant's segment by supplying its id. Mirrors the create path guard.
    await assertSurveySegmentBelongsToWorkspace(currentSurvey.workspaceId, segment);

    // ENG-1749 sibling: the languages block below links languages by language.id. Ensure every
    // referenced language belongs to this survey's workspace so a caller cannot attach another
    // tenant's language. Mirrors the create path guard (covers drafts too — runs before validation).
    await assertSurveyLanguagesBelongToWorkspace(currentSurvey.workspaceId, languages);

    // ENG-1939: validation may only be skipped while the survey is still a draft. Gate on the
    // PERSISTED status, not the payload's — the lenient draft schema (ZSurveyDraft) does not validate
    // elements at all, so without this a caller could push structurally invalid blocks onto a live
    // survey (crashing downstream consumers that trust the schema) and silently revert it to draft,
    // stopping it from collecting responses. Deliberately placed after the ENG-1749 tenant guards so
    // a cross-workspace attempt still reports the authorization failure first.
    if (skipValidation && currentSurvey.status !== "draft") {
      throw new OperationNotAllowedError("Only draft surveys can be updated without validation");
    }

    if (!skipValidation) {
      checkForInvalidImagesInQuestions(questions);

      // An app survey can never be shown without a trigger, so block publishing (non-draft status)
      // one with zero triggers. The editor enforces this client-side only; mirror it server-side.
      if (isAppSurveyMissingTriggersToPublish(type, updatedSurvey.status, triggers)) {
        throw new InvalidInputError(APP_SURVEY_TRIGGER_REQUIRED_MESSAGE);
      }
    }

    // Add blocks media validation. The validation error is already an InvalidInputError, so the
    // API layer maps it to a 400 instead of an unhandled 500.
    if (!skipValidation && updatedSurvey.blocks && updatedSurvey.blocks.length > 0) {
      const blocksValidation = checkForInvalidMediaInBlocks(updatedSurvey.blocks);
      if (!blocksValidation.ok) {
        throw blocksValidation.error;
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

        // ENG-1749/ENG-1920: the connected survey ids are client-supplied; ensure each belongs to
        // this survey's workspace before re-pointing it to the segment (a foreign id would hijack
        // another tenant's survey targeting). Done outside the try below, which masks errors as a
        // generic Error and would otherwise hide this rejection.
        if (segment.surveys && segment.surveys.length > 0) {
          const workspaceBySurveyId = await getSurveyWorkspaceIdMap(segment.surveys);
          if (
            !segment.surveys.every(
              (surveyId) => workspaceBySurveyId.get(surveyId) === currentSurvey.workspaceId
            )
          ) {
            throw new InvalidInputError("Survey and segment are not in the same workspace");
          }
        }

        try {
          // Update only the segment's own mutable fields — never mass-assign workspaceId/id/
          // timestamps from the client-supplied segment object (ENG-1749).
          const updatedInput: Prisma.SegmentUpdateInput = {
            title: segment.title,
            description: segment.description,
            isPrivate: segment.isPrivate,
            filters: segment.filters,
            ...(segment.surveys
              ? { surveys: { connect: segment.surveys.map((surveyId) => ({ id: surveyId })) } }
              : {}),
          };

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
        const workspaceId = currentSurvey.workspaceId;
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
    const persistedSurvey = await prisma.$transaction(
      async (tx) => {
        const survey = await tx.survey.update({
          where: { id: surveyId },
          data,
          select: selectSurvey,
        });

        // ENG-1978: mirror the saved fields into the EmbeddedData tables in the same transaction, so a
        // survey never commits without them. Derived from the PERSISTED survey rather than the payload:
        // a partial update leaves `variables` / `hiddenFields` untouched in the column, and reading the
        // payload instead would see them as absent and delete every row. workspaceId comes from the
        // stored survey for the ENG-1749 reason above — never from the client.
        //
        // NOTE (ENG-1837): `survey` was read BEFORE this reconcile, so the `embeddedDataLinks` it
        // carries — and the `embeddedFields` inlined from them by `transformPrismaSurvey` below —
        // describe the PRE-reconcile rows. A save that renames or removes a field therefore returns a
        // non-empty *stale* list. No consumer reads it today: the editor's save action feeds the
        // return into `setLocalSurvey` / `surveyRef.current` and every editor surface resolves through
        // `getDeclaredEmbeddedFields` (the cards); the v1 management route strips the key with
        // `withoutInternalSurveyProjections`; the summary's single-use action discards the value and
        // refreshes. The one surface that does carry it is the audit log's `newObject`.
        //
        // Deliberately NOT re-read here: it would put a second deep `selectSurvey` on the editor-save
        // hot path for a value nothing consumes. If a future consumer needs it (ENG-1853 pointing a
        // serializer at the rows), the fix must be a re-read through `selectSurvey` — which preserves
        // the returned object's key shape. Do not strip or re-derive the key instead: this return
        // value reaches `survey-menu-bar.tsx`, whose change detection deep-compares it against the
        // editor's working copy and short-circuits on differing key counts.
        await reconcileEmbeddedData(tx, {
          surveyId,
          workspaceId: currentSurvey.workspaceId,
          desired: toDesiredEmbeddedFields(survey),
        });

        return survey;
      },
      // Prisma's default interactive-transaction ceiling is 5s, which the write above can plausibly
      // approach on a large survey: it rewrites blocks, follow-ups, triggers and languages, then reads
      // back through `selectSurvey`'s deep select. Failing here loses the author's edit, while the
      // worst a slow commit costs is a held connection — so the timeout is raised rather than left to
      // turn a slow save into a failed one. The reconcile itself adds one indexed read plus a write per
      // changed field.
      { timeout: 20_000, maxWait: 10_000 }
    );

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

  if (Array.isArray(data.blocks) && data.blocks.length > 0) {
    return {
      ...data,
      blocks: validateMediaAndPrepareBlocks(data.blocks as unknown as TSurveyBlock[]),
    };
  }

  return data;
};

const assertSurveyLanguagesBelongToWorkspace = async (
  workspaceId: string,
  languages: Array<{ language: { id: string } }> | null | undefined
): Promise<void> => {
  const languageIds = [...new Set((languages ?? []).map((surveyLanguage) => surveyLanguage.language.id))];
  if (languageIds.length === 0) {
    return;
  }

  // ENG-1749: resolve each language's real owning workspace from the DB rather than trusting the
  // caller-supplied language.workspaceId — the survey payload is client-controlled, so an attacker
  // could otherwise claim a foreign language belongs to this workspace. A single batched query
  // avoids a per-language fan-out; an unknown id is absent from the map and thus rejected.
  const dbLanguages = await prisma.language.findMany({
    where: { id: { in: languageIds } },
    select: { id: true, workspaceId: true },
  });
  const workspaceByLanguageId = new Map(dbLanguages.map((language) => [language.id, language.workspaceId]));

  for (const languageId of languageIds) {
    if (workspaceByLanguageId.get(languageId) !== workspaceId) {
      throw new ResourceNotFoundError("Language", languageId);
    }
  }
};

const assertSurveySegmentBelongsToWorkspace = async (
  workspaceId: string,
  segment: { id?: string | null } | null | undefined
): Promise<void> => {
  if (!segment?.id) {
    return;
  }

  const existingSegment = await prisma.segment.findUnique({
    where: { id: segment.id },
    select: { workspaceId: true },
  });

  if (existingSegment?.workspaceId !== workspaceId) {
    throw new ResourceNotFoundError("Segment", segment.id);
  }
};

export const createSurvey = async (
  workspaceId: string,
  surveyBody: TSurveyCreateInput,
  privateSegmentFilters: TBaseFilters = []
): Promise<TSurvey> => {
  const [parsedWorkspaceId, parsedSurveyBody] = validateInputs(
    [workspaceId, ZId],
    [surveyBody, ZSurveyCreateInput]
  );

  try {
    const { createdBy, languages, segment, followUps, styling, ...restSurveyBody } = parsedSurveyBody;
    await assertSurveyLanguagesBelongToWorkspace(parsedWorkspaceId, languages);
    await assertSurveySegmentBelongsToWorkspace(parsedWorkspaceId, segment);

    // An app survey can never be shown without a trigger, so block creating one directly in a
    // non-draft status with zero triggers (mirrors the editor's publish guard).
    if (
      isAppSurveyMissingTriggersToPublish(
        restSurveyBody.type ?? "link",
        restSurveyBody.status ?? "draft",
        restSurveyBody.triggers
      )
    ) {
      throw new InvalidInputError(APP_SURVEY_TRIGGER_REQUIRED_MESSAGE);
    }
    const normalizedCloseOn = restSurveyBody.closeOn instanceof Date ? restSurveyBody.closeOn : null;
    const normalizedPublishOn = restSurveyBody.publishOn instanceof Date ? restSurveyBody.publishOn : null;
    const surveyLanguagesCreateData: Prisma.SurveyLanguageCreateNestedManyWithoutSurveyInput | undefined =
      languages?.length
        ? {
            create: languages.map((surveyLanguage) => ({
              language: {
                connect: {
                  id: surveyLanguage.language.id,
                },
              },
              default: surveyLanguage.default,
              enabled: surveyLanguage.enabled,
            })),
          }
        : undefined;

    const actionClasses = await getActionClasses(parsedWorkspaceId);

    const baseData = {
      ...restSurveyBody,
      styling: styling === null ? Prisma.JsonNull : styling,
      ...normalizeSurveyScheduling({
        closeOn: normalizedCloseOn,
        publishOn: normalizedPublishOn,
        status: restSurveyBody.status ?? "draft",
      }),
      languages: surveyLanguagesCreateData,
      segment: segment?.id ? { connect: { id: segment.id } } : undefined,
      triggers: restSurveyBody.triggers
        ? handleTriggerUpdates(restSurveyBody.triggers, [], actionClasses)
        : undefined,
      attributeFilters: undefined,
    } as Omit<Prisma.SurveyCreateInput, "workspace">;
    const data = validateSurveyCreateDataMedia(
      attachSurveyFollowUpsToCreateData(attachSurveyCreatorToCreateData(baseData, createdBy), followUps)
    );

    const organization = await getOrganizationByWorkspaceId(parsedWorkspaceId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", null);
    }

    // Create the survey and — for app surveys — its private targeting segment atomically. The survey,
    // the segment (seeded with any caller-supplied filters), and the segment connection must all land
    // or none, so a mid-write failure can't leave a survey with missing or partial targeting.
    const survey = await prisma.$transaction(
      async (tx) => {
        const createdSurvey = await tx.survey.create({
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

        if (createdSurvey.type === "app") {
          const newSegment = await tx.segment.create({
            data: {
              title: createdSurvey.id,
              filters: privateSegmentFilters,
              isPrivate: true,
              workspace: {
                connect: {
                  id: parsedWorkspaceId,
                },
              },
            },
          });

          await tx.survey.update({
            where: {
              id: createdSurvey.id,
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

        // ENG-1978: a survey created from a template, the API or a duplicate can already carry
        // variables and hidden fields, so the tables have to be populated at creation, not just on the
        // next save.
        await reconcileEmbeddedData(tx, {
          surveyId: createdSurvey.id,
          workspaceId: parsedWorkspaceId,
          desired: toDesiredEmbeddedFields(createdSurvey),
        });

        return createdSurvey;
      },
      // This transaction predates ENG-1978, but the reconcile above adds a read plus two writes per
      // field inside it, and neither `variables` nor `hiddenFields` is bounded — so a large template or
      // API create could now reach Prisma's 5s default where it used to fit. Matched to the other
      // reconcile call sites (enumerated on `getDeclaredEmbeddedFields`) rather than left to inherit
      // a ceiling this work made easier to hit.
      { timeout: 20_000, maxWait: 10_000 }
    );

    // TODO: Fix this, this happens because the survey type "web" is no longer in the zod types but its required in the schema for migration
    // @ts-expect-error
    const transformedSurvey: TSurvey = {
      // ENG-1837: this result is hand-built rather than routed through `transformPrismaSurvey`, so
      // the inlining has to happen here too — otherwise the raw relation leaks onto TSurvey. The
      // rows are reconciled *after* the create above, so the list is empty here and the accessor
      // falls back to the freshly written legacy columns, which carry the same definitions.
      ...withInlinedEmbeddedFields(survey),
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

    return transformPrismaSurvey<TSurvey>(prismaSurvey);
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
