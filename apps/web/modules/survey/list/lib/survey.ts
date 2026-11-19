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
import {
  DatabaseError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "@formbricks/types/errors";
import { TSurveyFilterCriteria } from "@formbricks/types/surveys/types";
import { reconcileEmbeddedData } from "@/lib/embedded-data/reconcile";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { fillSurveyBlockCodes } from "@/lib/survey/fill-codes";
import { checkForInvalidMediaInBlocks } from "@/lib/survey/utils";
import type { TSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { resolveSurveyCreationFacts } from "@/lib/survey/visibility/creation";
import { WorkspaceSurveyLimitError, assertWorkspaceSurveyLimit } from "@/lib/survey/visibility/limit";
import { type TSurveyVisibilityFilter, buildSurveyAccessWhere } from "@/lib/survey/visibility/predicate";
import { validateInputs } from "@/lib/utils/validate";
import { getTranslate } from "@/lingodotdev/server";
import { resolveCopiedSurveyCustomCss } from "@/modules/custom-css/lib/service";
import { assertSegmentSurveyFiltersVisible } from "@/modules/ee/contacts/segments/lib/helper";
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
      // ENG-3228: the copy follows the source's ROWS — the legacy shape cannot say that a field is a
      // link to the workspace library, so copying it localized every shared field a survey had.
      // Since ENG-2404 the rows are all there is. Selected with the row's ownership (`key`) and id
      // so `planCopiedEmbeddedFields` can decide per field whether to re-link it or clone it.
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
      // Behaviour, presentation and security settings. The copy is built by spreading whatever this
      // select returns, so a settings column missing here is not reset on purpose — it is never read,
      // and the new row silently falls back to its database default. That is how duplicates lost PIN
      // protection, response limits and redirect URLs (ENG-2144), and the recontact fields before
      // that (#6802). Add new Survey settings columns here; `survey.test.ts` fails if you forget.
      redirectUrl: true,
      autoComplete: true,
      autoClose: true,
      keepEndingCardOpen: true,
      delay: true,
      displayPercentage: true,
      showConditions: true,
      startLogic: true,
      showLanguageSwitch: true,
      autoSelectLanguage: true,
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
      // ENG-2949: read for its source only. It is never spread into the copy; the copy gets this source
      // processed afresh under the destination's plan (`resolveCopiedSurveyCustomCss`).
      customCss: true,
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
 * field's name is the legacy variable name or hidden field id the copy's derived `variables` /
 * `hiddenFields` will carry, and a label like `Plan tier` is not a legal one. The storage key is
 * preserved either way — it is the address recall tokens and logic operands inside the copied blocks
 * already point at.
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

type TCopiedSurvey = NonNullable<Awaited<ReturnType<typeof getExistingSurvey>>>;
type TTargetActionClass = Awaited<ReturnType<typeof findTargetActionClasses>>[number];

/** A JSON column's copy: a deep clone of its value, or the given null when it has none. */
const cloneJsonOr = <T, TNull>(value: T | null | undefined, fallback: TNull): T | TNull =>
  value ? structuredClone(value) : fallback;

/** Another workspace a survey is copied into, after checking the copier may carry its head scripts there. */
const resolveOtherTargetWorkspace = async (
  targetWorkspaceId: string,
  userId: string,
  customHeadScripts: TCopiedSurvey["customHeadScripts"]
): Promise<TWorkspaceWithLanguages> => {
  const [, targetWorkspace] = await Promise.all([
    doesWorkspaceExist(targetWorkspaceId),
    getWorkspaceWithLanguages(targetWorkspaceId),
  ]);

  if (!targetWorkspace) throw new ResourceNotFoundError("Workspace", targetWorkspaceId);

  // The copy runs these scripts on the target workspace's link surveys, where no one with Manage
  // access has approved them, so carrying them over takes Manage there — as writing them would.
  await assertCanWriteCustomHeadScripts(
    { type: "user", id: userId },
    targetWorkspace.id,
    { customHeadScripts },
    null
  );
  return targetWorkspace;
};

const findTargetActionClasses = (workspaceId: string) =>
  prisma.actionClass.findMany({
    where: { workspaceId },
    select: { name: true, type: true, key: true, noCodeConfig: true, id: true },
  });

/** The copy's languages, connected to (or created in) the target workspace's language list. */
const buildCopiedLanguages = (existingSurvey: TCopiedSurvey, targetWorkspaceId: string) => {
  const hasLanguages = existingSurvey.languages && existingSurvey.languages.length > 0;
  if (!hasLanguages) return undefined;
  return {
    create: existingSurvey.languages.map((surveyLanguage) => ({
      language: {
        connectOrCreate: {
          where: {
            workspaceId_code: { code: surveyLanguage.language.code, workspaceId: targetWorkspaceId },
          },
          create: {
            code: surveyLanguage.language.code,
            alias: surveyLanguage.language.alias,
            workspaceId: targetWorkspaceId,
          },
        },
      },
      default: surveyLanguage.default,
      enabled: surveyLanguage.enabled,
    })),
  };
};

/** An action class in the target workspace the trigger can reuse: the same code key, or the same no-code config. */
const findReusableActionClass = (
  trigger: TCopiedSurvey["triggers"][number],
  existingActionClasses: TTargetActionClass[]
): TTargetActionClass | undefined => {
  //check if an action class with same config already exists
  if (trigger.actionClass.type === "code") {
    return existingActionClasses.find((ac) => ac.key === trigger.actionClass.key);
  }
  if (trigger.actionClass.type === "noCode") {
    return existingActionClasses.find(
      (ac) => JSON.stringify(ac.noCodeConfig) === JSON.stringify(trigger.actionClass.noCodeConfig)
    );
  }
  return undefined;
};

/** A unique name by appending (copy), (copy 2), (copy 3), etc. */
const getUniqueCopyName = (
  name: string,
  existingActionClassNames: Set<string>,
  t: Awaited<ReturnType<typeof getTranslate>>
): string => {
  let copyNumber = 1;
  let candidateName = `${name} ${t("common.duplicate_copy")}`;

  while (existingActionClassNames.has(candidateName)) {
    copyNumber++;
    candidateName = `${name} ${t("common.duplicate_copy_number", { copyNumber })}`;
  }
  return candidateName;
};

/** The copy's trigger: an existing action class reused or connected, or one created in the target. */
const copyTriggerInput = (
  trigger: TCopiedSurvey["triggers"][number],
  {
    existingActionClasses,
    isSameWorkspace,
    targetWorkspaceId,
    t,
  }: {
    existingActionClasses: TTargetActionClass[];
    isSameWorkspace: boolean;
    targetWorkspaceId: string;
    t: Awaited<ReturnType<typeof getTranslate>>;
  }
): Prisma.SurveyTriggerCreateWithoutSurveyInput => {
  const existingActionClass = findReusableActionClass(trigger, existingActionClasses);
  if (existingActionClass) {
    return {
      actionClass: { connect: { id: existingActionClass.id } },
    };
  }

  const existingActionClassNames = new Set(existingActionClasses.map((ac) => ac.name));

  // Check if an action class with the same name but different type already exists
  const hasNameConflict = !isSameWorkspace && existingActionClassNames.has(trigger.actionClass.name);

  const modifiedName = hasNameConflict
    ? getUniqueCopyName(trigger.actionClass.name, existingActionClassNames, t)
    : trigger.actionClass.name;

  const baseActionClassData = {
    name: modifiedName,
    workspace: { connect: { id: targetWorkspaceId } },
    description: trigger.actionClass.description,
    type: trigger.actionClass.type,
  };

  if (isSameWorkspace) {
    return {
      actionClass: { connect: { id: trigger.actionClass.id } },
    };
  }
  if (trigger.actionClass.type === "code") {
    return {
      actionClass: {
        connectOrCreate: {
          where: {
            key_workspaceId: {
              key: trigger.actionClass.key!,
              workspaceId: targetWorkspaceId,
            },
          },
          create: {
            ...baseActionClassData,
            key: trigger.actionClass.key,
          },
        },
      },
    };
  }

  const noCodeConfig = trigger.actionClass.noCodeConfig
    ? structuredClone(trigger.actionClass.noCodeConfig)
    : undefined;
  if (hasNameConflict) {
    return {
      actionClass: {
        create: {
          ...baseActionClassData,
          noCodeConfig,
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
            workspaceId: targetWorkspaceId,
          },
        },
        create: {
          ...baseActionClassData,
          noCodeConfig,
        },
      },
    },
  };
};

const copyQuotaData = (existingQuotas: Awaited<ReturnType<typeof getQuotas>>) =>
  existingQuotas.map((quota) => ({
    name: quota.name,
    logic: quota.logic,
    limit: quota.limit,
    action: quota.action,
    endingCardId: quota.endingCardId,
    countPartialSubmissions: quota.countPartialSubmissions,
  }));

/**
 * The copy's segment: a private one is recreated for it; a public one is shared in the same workspace,
 * and recreated in another (renamed when the target already has one by that title).
 */
const buildCopiedSegment = async (
  segment: NonNullable<TCopiedSurvey["segment"]>,
  surveyId: string,
  isSameWorkspace: boolean,
  targetWorkspaceId: string
): Promise<Prisma.SurveyCreateInput["segment"]> => {
  if (segment.isPrivate) {
    return {
      create: {
        title: surveyId,
        isPrivate: true,
        filters: segment.filters,
        workspace: { connect: { id: targetWorkspaceId } },
      },
    };
  }
  if (isSameWorkspace) {
    return { connect: { id: segment.id } };
  }
  const existingSegmentInTargetEnvironment = await prisma.segment.findFirst({
    where: {
      title: segment.title,
      isPrivate: false,
      workspaceId: targetWorkspaceId,
    },
  });

  return {
    create: {
      title: existingSegmentInTargetEnvironment ? `${segment.title}-${Date.now()}` : segment.title,
      isPrivate: false,
      filters: segment.filters,
      workspace: { connect: { id: targetWorkspaceId } },
    },
  };
};

/** The source workspace, survey, quotas and organization a copy reads; each must exist. */
const loadCopySource = async (workspaceId: string, surveyId: string) => {
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
  return { existingWorkspace, existingSurvey, existingQuotas, organization };
};

/** The copier must see every survey the copied segment's filters read, in the target workspace. */
const assertCopiedSegmentVisible = async (
  segment: NonNullable<TCopiedSurvey["segment"]>,
  {
    targetWorkspaceId,
    userId,
    organizationId,
    isSameWorkspace,
  }: { targetWorkspaceId: string; userId: string; organizationId: string; isSameWorkspace: boolean }
): Promise<void> => {
  await assertSegmentSurveyFiltersVisible(
    segment.filters,
    targetWorkspaceId,
    await resolveSurveyActorContext({ type: "user", id: userId }, organizationId),
    isSameWorkspace && !segment.isPrivate ? segment.id : undefined
  );
};

const getTargetOrganizationId = async (targetWorkspaceId: string): Promise<string> => {
  const targetOrganizationId = (await getOrganizationByWorkspaceId(targetWorkspaceId))?.id ?? null;
  if (!targetOrganizationId) throw new ResourceNotFoundError("Organization", targetWorkspaceId);
  return targetOrganizationId;
};

/** The error a failed copy surfaces: database errors and the survey limit mapped, anything else as is. */
const toCopySurveyError = (error: unknown): unknown => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error(error, "Error copying survey to other workspace");
    return new DatabaseError(error.message);
  }
  if (error instanceof WorkspaceSurveyLimitError) {
    return new OperationNotAllowedError("The target workspace has reached its survey limit");
  }
  return error;
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
    const { existingWorkspace, existingSurvey, existingQuotas, organization } = await loadCopySource(
      workspaceId,
      surveyId
    );

    // ENG-6870: a copy keeps the source's targeting (it connects the public segment, or writes its filters
    // into a new one in the target), and the copier then reads the copy's responses, so the copier must
    // see every survey that targeting reads *in the workspace it lands in*. Checked against the target:
    // a stored filter can name an id that is foreign to the source but a hidden survey in the target.
    if (existingSurvey.segment) {
      await assertCopiedSegmentVisible(existingSurvey.segment, {
        targetWorkspaceId,
        userId,
        organizationId: organization.id,
        isSameWorkspace,
      });
    }

    const isQuotasAllowed = await getIsQuotasEnabled(organization.id);

    const targetWorkspace = isSameWorkspace
      ? existingWorkspace
      : await resolveOtherTargetWorkspace(targetWorkspaceId, userId, existingSurvey.customHeadScripts);

    // Fetch existing action classes in target workspace for name conflict checks
    const existingActionClasses = isSameWorkspace ? [] : await findTargetActionClasses(targetWorkspace.id);

    // ENG-3282: a copy is a new survey on every count — the target workspace's cap applies, and it is
    // owned by the person copying it, with the visibility a fresh creation in the target organization
    // would get. Neither is read from the source: `getExistingSurvey` selects no visibility column.
    await assertWorkspaceSurveyLimit(targetWorkspace.id);
    const targetOrganizationId = isSameWorkspace
      ? organization.id
      : await getTargetOrganizationId(targetWorkspace.id);
    const creationFacts = await resolveSurveyCreationFacts({
      actor: { type: "user", id: userId },
      organizationId: targetOrganizationId,
    });

    // The relation is the copy's Embedded Data plan, not a column to clone: `Survey` owns a relation
    // by this name, so spreading it into `SurveyCreateInput` would be a nested relation write.
    // ENG-2949: custom CSS is carried as source and processed for the destination, under the destination
    // organization's plan. A destination that may not add CSS still gets the copy — without the CSS, and
    // with a notice — and the source survey is only ever read.
    const { embeddedDataLinks, customCss: sourceCustomCss, ...restExistingSurvey } = existingSurvey;
    const copiedCustomCss = await resolveCopiedSurveyCustomCss({
      source: sourceCustomCss,
      destinationOrganizationId: targetOrganizationId,
      principal: userId,
    });
    const t = await getTranslate();

    // Zero rows is zero fields (ENG-2404): the migration that dropped the legacy columns gave every
    // survey still without links the rows its columns described, so there is nothing else to read.
    const copiedEmbeddedFields = await planCopiedEmbeddedFields(embeddedDataLinks, {
      isSameWorkspace,
      targetWorkspaceId: targetWorkspace.id,
    });

    // Prepare survey data
    const surveyData: Prisma.SurveyCreateInput = {
      ...restExistingSurvey,
      id: createId(),
      name: `${existingSurvey.name} ${t("common.duplicate_copy")}`,
      type: existingSurvey.type,
      status: "draft",
      welcomeCard: structuredClone(existingSurvey.welcomeCard),
      // ENG-6782: the copy keeps every code; an older survey that never had any is coded here.
      blocks: fillSurveyBlockCodes(structuredClone(existingSurvey.blocks), {
        embeddedFields: copiedEmbeddedFields,
      }),
      endings: structuredClone(existingSurvey.endings),
      languages: buildCopiedLanguages(existingSurvey, targetWorkspace.id),
      triggers: {
        create: existingSurvey.triggers.map((trigger) =>
          copyTriggerInput(trigger, {
            existingActionClasses,
            isSameWorkspace,
            targetWorkspaceId: targetWorkspace.id,
            t,
          })
        ),
      },
      workspace: {
        connect: {
          id: targetWorkspace.id,
        },
      },
      creator: {
        connect: {
          id: userId,
        },
      },
      owner: { connect: { id: userId } },
      visibility: creationFacts.visibility,
      ownershipInitialized: true,
      surveyClosedMessage: cloneJsonOr(existingSurvey.surveyClosedMessage, Prisma.JsonNull),
      singleUse: cloneJsonOr(existingSurvey.singleUse, Prisma.JsonNull),
      workspaceOverwrites: cloneJsonOr(existingSurvey.workspaceOverwrites, Prisma.JsonNull),
      styling: cloneJsonOr(existingSurvey.styling, Prisma.JsonNull),
      // Holds no ids, so it copies to another workspace as it is.
      showConditions: cloneJsonOr(existingSurvey.showConditions, Prisma.DbNull),
      // Names this survey's own blocks, endings and fields, whose ids the copy keeps.
      startLogic: cloneJsonOr(existingSurvey.startLogic, Prisma.DbNull),
      // "replace" means "run only this survey's scripts, not the workspace's". In another workspace
      // that would silently switch off the target's own head scripts (analytics, consent), so the
      // copy keeps its scripts but adds them to the target's instead.
      customHeadScriptsMode: isSameWorkspace ? existingSurvey.customHeadScriptsMode : "add",
      ...(copiedCustomCss.customCss ? { customCss: copiedCustomCss.customCss } : {}),
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
          data: isQuotasAllowed ? copyQuotaData(existingQuotas) : [],
        },
      },
    };

    // Handle segment
    if (existingSurvey.segment) {
      surveyData.segment = await buildCopiedSegment(
        existingSurvey.segment,
        surveyData.id!,
        isSameWorkspace,
        targetWorkspace.id
      );
    }

    if (surveyData.blocks) {
      const result = checkForInvalidMediaInBlocks(surveyData.blocks);
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

        // The legacy keys this result has always carried (it is the audit log's `newObject`), derived
        // from the plan the rows were just written from, as every other read derives them.
        return {
          ...createdSurvey,
          ...toLegacyEmbeddedFields(linkedToDesiredEmbeddedFields(copiedEmbeddedFields)),
          // ENG-2949: why the copy has no custom CSS although its source had some. Absent otherwise.
          ...(copiedCustomCss.notice ? { customCssNotice: copiedCustomCss.notice } : {}),
        };
      },
      // This create was untransacted before ENG-1978, so wrapping it introduced Prisma's 5s
      // interactive-transaction ceiling where there had been none. It is the deepest of the
      // reconcile call sites (a `reconcileEmbeddedData(` grep enumerates them) — it clones blocks,
      // endings, the welcome card, Embedded Data, follow-ups and quotas, and resolves an action
      // class per trigger through `connectOrCreate` — so a large survey could plausibly reach it and
      // fail a copy that used to succeed. Matches the ceiling on `updateSurveyInternal` for the same
      // reason.
      { timeout: 20_000, maxWait: 10_000 }
    );

    return newSurvey;
  } catch (error) {
    throw toCopySurveyError(error);
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
