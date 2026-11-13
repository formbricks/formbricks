import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import type { TCustomCssStored } from "@formbricks/types/custom-css";
import {
  linkedToDesiredEmbeddedFields,
  toLegacyEmbeddedFields,
} from "@formbricks/types/embedded-data-mapping";
import {
  DatabaseError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "@formbricks/types/errors";
import {
  MAX_SEGMENT_SURVEYS,
  TBaseFilters,
  ZSegmentFilters,
  ZSegmentSurveyIds,
  getSegmentFilterTreeBoundsViolation,
} from "@formbricks/types/segment";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import {
  type TDeclaredFieldSource,
  describeDeclaredFieldNameErrors,
  validateNewDeclaredFields,
} from "@formbricks/types/surveys/declared-field-guard";
import { carryOverCodes } from "@formbricks/types/surveys/fill-missing-codes";
import {
  describePublishedLockViolations,
  getPublishedLockViolations,
} from "@formbricks/types/surveys/published-lock";
import {
  TSurvey,
  TSurveyCreateInput,
  TSurveyVariables,
  ZStoredSurveyVariables,
  ZSurvey,
  ZSurveyCreateInput,
  ZSurveyHiddenFields,
} from "@formbricks/types/surveys/types";
import { lockSurveyVisibility } from "@/lib/authzed/survey";
import {
  assertLinkableEmbeddedFields,
  assertWritableEmbeddedFields,
  getLegacyWriteEmbeddedFields,
  reconcileEmbeddedData,
} from "@/lib/embedded-data/reconcile";
import { selectSurveyEmbeddedDataLinks, withInlinedEmbeddedFields } from "@/lib/embedded-data/survey-fields";
import { scheduleFeedbackSourceReconciliation } from "@/lib/feedback-source/mapping-reconciliation";
import {
  getOrganizationByWorkspaceId,
  subscribeOrganizationMembersToSurveyResponses,
} from "@/lib/organization/service";
import { fillSurveyBlockCodes } from "@/lib/survey/fill-codes";
import type { TSurveyCreationFacts } from "@/lib/survey/visibility/creation";
import { andVisibleSurveys, buildHiddenSurveyWhere } from "@/lib/survey/visibility/predicate";
import {
  SURVEY_WRITE_TRANSACTION_OPTIONS,
  SurveyWriteAfterCommitError,
  type TSurveyWriteTransaction,
} from "@/lib/survey/write-transaction";
import {
  invalidateCustomCssCaches,
  parseStoredCustomCss,
  readCustomCssPayloadSource,
  resolveCustomCssWriteOrThrow,
} from "@/modules/custom-css/lib/service";
import {
  assertAddedSegmentSurveyFiltersVisible,
  assertSegmentSurveyFiltersVisible,
  getAddedSegmentSurveyIds,
} from "@/modules/ee/contacts/segments/lib/helper";
import {
  assertNoLinkedCreatives,
  getDestinationSettingTurnedOn,
} from "@/modules/ee/creatives/lib/linked-creatives";
import { isAppSurveyBlockedFromPublishing } from "@/modules/ee/creatives/lib/survey-publish";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { hasMatrixElement, syncQuotaMatrixConditions } from "@/modules/ee/quotas/lib/quotas";
import { handleTriggerUpdates } from "@/modules/survey/lib/trigger-updates";
import {
  isSurveySchedulingDue,
  normalizeSurveyScheduling,
  reconcileDueSurveySchedules,
} from "@/modules/survey/scheduling/lib/survey-scheduling";
import { getActionClasses, getActionClassesInTransaction } from "../actionClass/service";
import { ITEMS_PER_PAGE } from "../constants";
import { loggableError } from "../utils/loggable-error";
import { validateInputs } from "../utils/validate";
import { APP_SURVEY_TRIGGER_REQUIRED_MESSAGE, isAppSurveyMissingTriggersToPublish } from "./publish-rule";
import {
  checkForInvalidImagesInQuestions,
  checkForInvalidMediaInBlocks,
  stripIsDraftFromBlocks,
  transformPrismaSurvey,
  validateMediaAndPrepareBlocks,
} from "./utils";
import type { TSurveyActorContext } from "./visibility/actor-context";

/**
 * ENG-1839 / ENG-2933 / ENG-3142: refuse a reserved name, or a name a hidden field shares with a
 * variable or an element, for newly declared fields — as an `InvalidInputError`, which
 * `handleApiError` maps to a 400 carrying this message, and the editor surfaces as a toast. Thrown
 * before any transaction is opened, so a refusal never fails inside an interactive transaction.
 *
 * Deliberately NOT inside `reconcileEmbeddedData`: that runs in the transaction, and the survey copy
 * flow feeds a whole survey's fields to it as "new" against zero existing rows — guarding there
 * would make duplicating a grandfathered survey fail.
 */
const assertValidNewDeclaredFields = (params: {
  existing: TDeclaredFieldSource;
  incoming: TDeclaredFieldSource;
}): void => {
  const errors = validateNewDeclaredFields(params);
  if (errors.length > 0) {
    throw new InvalidInputError(describeDeclaredFieldNameErrors(errors));
  }
};

/**
 * ENG-3228: the legacy `variables` / `hiddenFields` a payload's `embeddedFields` derive into, refused
 * as a 400 if they could not be read back.
 *
 * Nothing stores them since ENG-2404, but the read seam derives them from the rows on every load and
 * `ZSurvey` parses what it derived on every save — the editor sends the survey straight back — so a
 * storage key the client minted badly (a computed field whose key is not a cuid, an ingested one
 * carrying a space) would persist a survey whose next save fails. Checked here rather than in the
 * reconcile because this is the *client* boundary: the survey copy feeds the reconcile storage keys
 * of rows that already exist, including ones the ENG-1835 backfill moved across from columns no
 * schema ever vetted, and re-judging those would refuse to duplicate a survey that works today.
 */
const assertDerivedLegacyColumnsAreStorable = (columns: {
  variables: unknown;
  hiddenFields: unknown;
}): void => {
  const variables = ZStoredSurveyVariables.safeParse(columns.variables);
  if (!variables.success) {
    throw new InvalidInputError(
      `Embedded data fields cannot be stored as survey variables: ${variables.error.issues[0]?.message}`
    );
  }

  const hiddenFields = ZSurveyHiddenFields.safeParse(columns.hiddenFields);
  if (!hiddenFields.success) {
    throw new InvalidInputError(
      `Embedded data fields cannot be stored as hidden fields: ${hiddenFields.error.issues[0]?.message}`
    );
  }
};

export const selectSurvey = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  type: true,
  workspaceId: true,
  createdBy: true,
  visibility: true,
  ownerId: true,
  visibilityVersion: true,
  visibilityProjectedVersion: true,
  visibilityChangedAt: true,
  visibilityChangedById: true,
  status: true,
  welcomeCard: true,
  questions: true,
  blocks: true,
  endings: true,
  displayOption: true,
  recontactDays: true,
  displayLimit: true,
  autoClose: true,
  keepEndingCardOpen: true,
  delay: true,
  displayPercentage: true,
  showConditions: true,
  startLogic: true,
  autoComplete: true,
  publishOn: true,
  closeOn: true,
  archivedAt: true,
  isVerifyEmailEnabled: true,
  isBackButtonHidden: true,
  isAutoProgressingEnabled: true,
  isCaptureIpEnabled: true,
  isAnonymizeResponsesEnabled: true,
  redirectUrl: true,
  workspaceOverwrites: true,
  styling: true,
  surveyClosedMessage: true,
  singleUse: true,
  pin: true,
  showLanguageSwitch: true,
  autoSelectLanguage: true,
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

/**
 * `selectSurvey` plus the stored custom CSS (source and compiled output, up to ~40 KB). Kept out of the
 * generic selector so the respondent hot paths built on `getSurvey` — response and display writes, file
 * uploads — never load it. The readers that use it select it on purpose: the save paths (this file and
 * API v3), whose results go back to the editor and to v3 serializers. A survey loaded without the column
 * has no `customCss` key at all, which every write path reads as "leave the CSS unchanged".
 */
export const selectSurveyWithCustomCss = {
  ...selectSurvey,
  customCss: true,
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
    select: selectSurveyWithCustomCss,
  });

  if (!reconciledSurvey) {
    throw new ResourceNotFoundError("Survey", survey.id);
  }

  return transformPrismaSurvey<TSurvey>(reconciledSurvey);
};

const findSurveyById = async (
  surveyId: string,
  select: typeof selectSurvey | typeof selectSurveyWithCustomCss
): Promise<TSurvey | null> => {
  validateInputs([surveyId, ZId]);

  let surveyPrisma;
  try {
    surveyPrisma = await prisma.survey.findUnique({
      where: {
        id: surveyId,
      },
      select,
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
};

/** A survey without its stored custom CSS — see {@link selectSurveyWithCustomCss}. */
export const getSurvey = reactCache(
  async (surveyId: string): Promise<TSurvey | null> => await findSurveyById(surveyId, selectSurvey)
);

/**
 * {@link getSurvey} with the stored custom CSS, for the readers that serialize or edit it (API v3). Not for
 * respondent paths: they receive compiled CSS through the delivery code, never the stored value.
 */
export const getSurveyWithCustomCss = reactCache(
  async (surveyId: string): Promise<TSurvey | null> =>
    await findSurveyById(surveyId, selectSurveyWithCustomCss)
);

/**
 * {@link getSurveyWithCustomCss} for a page of one workspace's surveys, in one query (API v3 list,
 * `view=full`), each with its owner's display name read in the same snapshot. The caller bounds
 * `surveyIds` by its page size and passes its visibility clause, so a survey restricted since it was
 * listed is not read. Ids outside the workspace or that clause, or deleted since, are simply absent; the
 * result is in no particular order.
 */
export const getSurveysWithCustomCssAndOwnerName = async (
  workspaceId: string,
  surveyIds: string[],
  visibleSurveyWhere: Prisma.SurveyWhereInput
): Promise<Array<{ survey: TSurvey; ownerName: string | null }>> => {
  validateInputs([workspaceId, ZId], [surveyIds, ZId.array()]);
  if (surveyIds.length === 0) return [];

  try {
    const surveysPrisma = await prisma.survey.findMany({
      where: { id: { in: surveyIds }, workspaceId, ...andVisibleSurveys(visibleSurveyWhere) },
      select: { ...selectSurveyWithCustomCss, owner: { select: { name: true } } },
    });
    return surveysPrisma.map(({ owner, ...surveyPrisma }) => ({
      survey: transformPrismaSurvey<TSurvey>(surveyPrisma),
      ownerName: owner?.name ?? null,
    }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(loggableError(error), "Error getting surveys by id");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getSurveysByActionClassId = reactCache(
  async (
    actionClassId: string,
    workspaceId: string,
    /** ENG-3282: the caller's survey-visibility clause. */
    visibleSurveyWhere: Prisma.SurveyWhereInput,
    page?: number
  ): Promise<TSurvey[]> => {
    validateInputs([actionClassId, ZId], [workspaceId, ZId], [page, ZOptionalNumber]);

    let surveysPrisma;
    try {
      surveysPrisma = await prisma.survey.findMany({
        where: {
          // An action class belongs to one workspace; scope to it rather than trusting the join alone.
          workspaceId,
          ...andVisibleSurveys(visibleSurveyWhere),
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
  async (
    workspaceId: string,
    /** ENG-3282: the caller's survey-visibility clause; see `lib/survey/visibility/predicate.ts`. */
    visibleSurveyWhere: Prisma.SurveyWhereInput,
    limit?: number,
    offset?: number
  ): Promise<TSurvey[]> => {
    validateInputs([workspaceId, ZId], [limit, ZOptionalNumber], [offset, ZOptionalNumber]);

    try {
      const surveysPrisma = await prisma.survey.findMany({
        where: {
          workspaceId,
          // Archived surveys are hidden by default across the app.
          archivedAt: null,
          ...andVisibleSurveys(visibleSurveyWhere),
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

/** The survey's stored custom CSS, read from the row (tenant-scoped by workspace). */
const getStoredSurveyCustomCss = async (surveyId: string, workspaceId: string) => {
  const row = await prisma.survey.findUnique({
    where: { id: surveyId, workspaceId },
    select: { customCss: true },
  });
  if (!row) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }
  return parseStoredCustomCss(row.customCss);
};

export type TUpdateSurveyOptions = {
  /**
   * The acting user's id, charged when the save adds or edits custom CSS — the budget CSS validation
   * spends, so the editor's save and autosave cannot run the processor outside it.
   */
  customCssPrincipal?: string;
  /**
   * ENG-6870: who is saving, in survey-visibility terms. An app survey's targeting filters may only add
   * surveys this actor can see, so a save that adds any fails without it.
   */
  targetingActor?: TSurveyActorContext;
};

/** Whether the workspace's organization is licensed for quotas; a workspace with none is not. */
const getIsQuotasEnabledForWorkspace = async (workspaceId: string): Promise<boolean> => {
  const organization = await getOrganizationByWorkspaceId(workspaceId);
  return organization ? getIsQuotasEnabled(organization.id) : false;
};

export const updateSurveyInternal = async (
  updatedSurvey: TSurvey,
  skipValidation = false,
  options: TUpdateSurveyOptions = {}
): Promise<TSurvey> => {
  // A legacy write (only `variables` / `hiddenFields`, the v1 PUT) is validated once the stored rows
  // are read, against the rows it will leave the survey with: logic may set or read a computed date
  // the legacy keys can't say (ENG-6935).
  const isLegacyWrite = updatedSurvey.embeddedFields === undefined;
  if (!skipValidation && !isLegacyWrite) {
    validateInputs([updatedSurvey, ZSurvey]);
  }

  try {
    const surveyId = updatedSurvey.id;
    let data: any = {};

    const currentSurvey = await getSurvey(surveyId);

    if (!currentSurvey) {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    if (!skipValidation && isLegacyWrite) {
      validateInputs([
        {
          ...updatedSurvey,
          embeddedFields: getLegacyWriteEmbeddedFields(currentSurvey.embeddedFields ?? [], updatedSurvey),
        },
        ZSurvey,
      ]);
    }

    // Archived surveys are read-only. This covers every write path that flows through here
    // (editor save, the summary status dropdown's server action, etc.) — not just the v3 API.
    // Archive/restore themselves bypass this guard: they write archivedAt directly, not via update.
    if (currentSurvey.archivedAt) {
      throw new InvalidInputError("This survey is archived. Restore it before editing.");
    }

    // ENG-6783: once published, codes, question types and option text are locked (ADR 0020). The
    // comparison is against the stored survey, so a client cannot unlock an element by flagging it
    // `isDraft`. Covers the editor save and v1 PUT; v3 PATCH runs the same function in its own path.
    if (currentSurvey.status !== "draft") {
      const lockViolations = getPublishedLockViolations(currentSurvey, updatedSurvey);
      if (lockViolations.length > 0) {
        throw new InvalidInputError(describePublishedLockViolations(lockViolations));
      }
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
      // ENG-3228: `embeddedFields` is now accepted input as well as a read projection, but it is
      // still never spread into Prisma — `surveyData` goes straight into `tx.survey.update`'s
      // `data`, and `Survey` owns relations named `embeddedData` / `embeddedDataLinks`, so leaving
      // it in would turn the payload into a nested relation write. It reaches the database through
      // `reconcileEmbeddedData` alone. ENG-2404: so do the two legacy keys, which have no column any
      // more — Prisma would refuse them as unknown arguments.
      embeddedFields,
      variables,
      hiddenFields,
      // ENG-3282: authorization facts are server-owned. Visibility changes go through the dedicated
      // endpoint under the per-survey lock; a survey save must never write them, or it would race it.
      visibility: _visibility,
      ownerId: _ownerId,
      visibilityVersion: _visibilityVersion,
      visibilityProjectedVersion: _visibilityProjectedVersion,
      visibilityChangedAt: _visibilityChangedAt,
      visibilityChangedById: _visibilityChangedById,
      // ENG-2949: never spread. Only its source is read, and it reaches the row through the shared
      // custom CSS service below, so a caller's compiled CSS or processor version is never stored.
      customCss,
      ...surveyData
    } = updatedSurvey;

    // **Every Embedded Data refusal, before anything is written.** The segment block below writes
    // through `prisma`, not through the transaction further down, so a refusal raised later would
    // roll the survey update back and leave that segment change committed — a save carrying a
    // segment edit beside an unstorable field would half-apply.
    //
    // All four refusals are therefore spent here: the two pure ones, the workspace lookup behind the
    // shared links, and the derived legacy projection. The reconcile re-runs the first two inside the
    // transaction, which is what protects its other callers; re-running them is cheap and keeps that
    // function safe on its own.
    if (embeddedFields !== undefined) {
      const declared = linkedToDesiredEmbeddedFields(embeddedFields);
      assertWritableEmbeddedFields(declared);
      // Shared entries come back carrying the library's own definition rather than the payload's
      // claim about it, so the projection checked below is the one the read seam will derive.
      const desired = await assertLinkableEmbeddedFields(prisma, {
        workspaceId: currentSurvey.workspaceId,
        desired: declared,
      });
      assertDerivedLegacyColumnsAreStorable(toLegacyEmbeddedFields(desired));
    }

    // ENG-1749 sibling: the segment block below updates/deletes by segment.id directly. Ensure the
    // segment belongs to this survey's workspace so a caller cannot mutate or delete another
    // tenant's segment by supplying its id. Mirrors the create path guard.
    await assertSurveySegmentBelongsToWorkspace(currentSurvey.workspaceId, segment);

    // ENG-1749 sibling: the languages block below links languages by language.id. Ensure every
    // referenced language belongs to this survey's workspace so a caller cannot attach another
    // tenant's language. Mirrors the create path guard (covers drafts too — runs before validation).
    await assertSurveyLanguagesBelongToWorkspace(currentSurvey.workspaceId, languages);

    // ENG-1839: a newly declared field may not take a reserved name. ENG-2933: nor may a variable and
    // a hidden field newly share one — the reconcile cannot see that clash, because a variable is
    // stored under its id and a hidden field under its name. Runs here — before the transaction, and
    // regardless of `skipValidation` — because this is an input-boundary check, not schema
    // validation: `ZSurveyHiddenFields` stays lenient by design (the same schema parses surveys
    // loaded from the database), so without this `PUT /api/v1/management/surveys/<id>` can still
    // create a hidden field named `country` or `lang` that can never receive a value, or a variable
    // named after an existing hidden field. ENG-3142: nor a hidden field under an element's id, which
    // the answer always owns in `response.data`. Grandfathering is what makes it safe: `existing` is
    // everything this survey already declares, and any name — or clash — in it passes untouched.
    assertValidNewDeclaredFields({ existing: currentSurvey, incoming: updatedSurvey });

    // A creative's Destination can't be single-use or PIN-protected, so turning either on is refused
    // (409) while linked creatives open the survey. Checked here, before the segment writes below, and
    // again in the transaction under the lock a creative write takes to link a survey.
    const creativeBlockedChange = getDestinationSettingTurnedOn(currentSurvey, updatedSurvey);
    const linkedCreativesSurvey = { surveyId, workspaceId: currentSurvey.workspaceId };
    if (creativeBlockedChange) {
      await assertNoLinkedCreatives(prisma, linkedCreativesSurvey, creativeBlockedChange);
    }

    // ENG-1939/ENG-2115: validation may only be skipped for a draft-to-draft write, so BOTH sides of
    // the transition are gated. The lenient draft schema (ZSurveyDraft) does not validate elements at
    // all, so skipping validation on any other transition lets structurally invalid blocks reach the
    // DB and crash downstream consumers that trust the schema:
    //   - persisted status (ENG-1939): stops a caller pushing invalid blocks onto a live survey and
    //     silently reverting it to draft, stopping it from collecting responses.
    //   - payload status (ENG-2115): stops a caller publishing a draft that never passed ZSurvey.
    //     `status` is not destructured out of surveyData below, so it flows straight to the write.
    // Deliberately placed after the ENG-1749 tenant guards so a cross-workspace attempt still reports
    // the authorization failure first, and before prisma.survey.update so nothing is persisted.
    if (skipValidation && (currentSurvey.status !== "draft" || updatedSurvey.status !== "draft")) {
      throw new OperationNotAllowedError("Only draft surveys can be updated without validation");
    }

    if (!skipValidation) {
      checkForInvalidImagesInQuestions(questions);

      // An app survey can never be shown without a trigger or a creative that opens it, so block
      // publishing (non-draft status) one with neither. The editor runs the same rule before saving.
      if (
        await isAppSurveyBlockedFromPublishing({
          surveyId,
          workspaceId: currentSurvey.workspaceId,
          type,
          status: updatedSurvey.status,
          triggers,
        })
      ) {
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

    // ENG-2949: custom CSS is decided before anything is written — the segment block below writes
    // outside the transaction, so a refusal raised later would half-apply the save. Full-object payloads
    // (the editor's save and autosave) are revalidated from source against the stored row: unchanged
    // source costs no plan check and no processing, removal needs no plan, and an addition or edit needs
    // the plan, a unit of the custom CSS budget and a clean processor run. Failures keep the stored
    // revision.
    const customCssSource = readCustomCssPayloadSource(customCss);
    const customCssWrite =
      customCssSource === undefined
        ? null
        : await resolveCustomCssWriteOrThrow({
            scope: "survey",
            organizationId: async () => {
              const organization = await getOrganizationByWorkspaceId(currentSurvey.workspaceId);
              if (!organization) {
                throw new ResourceNotFoundError("Organization", null);
              }
              return organization.id;
            },
            // From the row, never from `currentSurvey`: `getSurvey` does not select the column, and a
            // missing value read as "no CSS" would turn a clear into a no-op.
            existing: await getStoredSurveyCustomCss(surveyId, currentSurvey.workspaceId),
            input: customCssSource,
            principal: options.customCssPrincipal,
          });

    if (languages) {
      // Process languages update logic here
      // Extract currentLanguageIds and updatedLanguageIds
      const currentLanguageIds = currentSurvey.languages
        ? currentSurvey.languages.map((l) => l.language.id)
        : [];
      const updatedLanguageIds =
        languages.length > 0 ? updatedSurvey.languages.map((l) => l.language.id) : [];
      const enabledLanguageIds = languages
        .filter((language) => language.enabled)
        .map((language) => language.language.id);

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
        data.languages.deleteMany = languagesToRemove.map((languageId) => ({ languageId }));
      }
    }

    if (triggers) {
      data.triggers = handleTriggerUpdates(triggers, currentSurvey.triggers, actionClasses);
    }

    // ENG-6957: the save changes this survey's targeting only. An app survey writes its own private
    // segment or links itself to a shared one; any other survey leaves its segment, and its private
    // segment is deleted unless another survey still uses it.
    if (segment) {
      if (type === "app") {
        // ENG-2305: tree bounds are enforced UNCONDITIONALLY — the draft save (skipValidation)
        // deliberately skips full semantic validation so half-built filters can be saved, but an
        // over-bounds tree persisted through it would break every consumer that parses the row
        // back (publish validation, clone, evaluation).
        const boundsViolation = getSegmentFilterTreeBoundsViolation(segment.filters);
        if (boundsViolation) {
          throw new InvalidInputError(boundsViolation);
        }

        // parse the segment filters:
        const parsedFilters = ZSegmentFilters.safeParse(segment.filters);
        if (!skipValidation && !parsedFilters.success) {
          throw new InvalidInputError("Invalid user segment filters");
        }

        // ENG-2305 sibling of the filter-tree gate above: on the draft path (skipValidation)
        // segment.surveys reaches this point unvalidated — ZSurveyDraft.segment is an untyped
        // record, so neither the ZId format rule nor the MAX_SEGMENT_SURVEYS cap has applied. Both
        // hold unconditionally; the validated (non-draft) path re-checks the same schema it already
        // passed, a no-op. Only this survey's own id in the list is acted on (ENG-6957).
        if (segment.surveys && !ZSegmentSurveyIds.safeParse(segment.surveys).success) {
          throw new InvalidInputError(
            `Invalid segment surveys: at most ${MAX_SEGMENT_SURVEYS} valid survey ids are allowed`
          );
        }

        await saveAppSurveySegment(currentSurvey, segment, options.targetingActor);
      } else {
        await unlinkSurveySegment(currentSurvey);
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
      // ENG-6782: an element re-sent without a code (an older client, the v1 API) keeps its stored
      // code, matched by id; what is still uncoded then gets the next default.
      data.blocks = fillSurveyBlockCodes(
        carryOverCodes(currentSurvey.blocks, stripIsDraftFromBlocks(updatedSurvey.blocks)),
        updatedSurvey
      );
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

    if (customCssWrite?.changed) {
      data.customCss = customCssWrite.stored ?? Prisma.DbNull;
    }

    // A nullable JSON column takes `Prisma.DbNull`, not `null`, to store "no conditions".
    if (data.showConditions === null) {
      data.showConditions = Prisma.DbNull;
    }
    if (data.startLogic === null) {
      data.startLogic = Prisma.DbNull;
    }

    // ENG-6934: the quotas' matrix conditions follow a row or column reorder only where quotas are
    // licensed, as every other quota write is. The license is resolved here, outside the transaction.
    const syncsQuotaMatrix =
      Array.isArray(data.blocks) &&
      hasMatrixElement(data.blocks) &&
      (await getIsQuotasEnabledForWorkspace(currentSurvey.workspaceId));

    delete data.createdBy;
    const persistedSurvey = await prisma.$transaction(
      async (tx) => {
        if (creativeBlockedChange) {
          await lockSurveyVisibility(tx, surveyId);
          await assertNoLinkedCreatives(tx, linkedCreativesSurvey, creativeBlockedChange);
        }

        // Narrow select: what this update returns would describe the survey before the reconcile
        // below, and the re-read at the end of the transaction is what the caller gets instead.
        // Scoped by workspace as well as id, per the repo's data-access rule. `Survey.id` is globally
        // unique and every caller authorizes the workspace before reaching here, so this is the rule
        // rather than a bypass being closed — the predicate is what keeps that true if a future
        // caller forgets.
        await tx.survey.update({
          where: { id: surveyId, workspaceId: currentSurvey.workspaceId },
          data,
          select: { id: true },
        });

        // ENG-6934: the quotas' matrix conditions follow a row or column reorder, as the blocks' do.
        if (syncsQuotaMatrix) await syncQuotaMatrixConditions(tx, surveyId, data.blocks);

        // ENG-1978: write the saved fields into the EmbeddedData tables in the same transaction, so a
        // survey never commits without them. ENG-2412: from the PAYLOAD — the rows are the only place
        // Embedded Data is stored (ENG-2404). A caller that omits every key is not saying "delete
        // these" — `reconcileEmbeddedData` carries the current rows over untouched. ENG-3228:
        // `embeddedFields`, when the payload carries it, is the complete set for both sources and the
        // two legacy keys beside it are ignored. workspaceId comes from the stored survey for the
        // ENG-1749 reason above — never from the client.
        await reconcileEmbeddedData(tx, {
          surveyId,
          workspaceId: currentSurvey.workspaceId,
          patch: { variables, hiddenFields, embeddedFields },
        });

        // Re-read AFTER the reconcile (ENG-3228). `survey` above was selected before the rows moved,
        // so its `embeddedDataLinks` — and the `embeddedFields` inlined from them by
        // `transformPrismaSurvey` below — would describe the PRE-reconcile state: a save that renamed
        // a field would return the old name, and one that created a field would return it without the
        // `id`, `key`, `locked` and storage key the editor needs to send it back next time. The editor
        // replaces its local copy from this return, so a stale list is the difference between a second
        // save that edits a field and one that recreates it.
        //
        // The second deep `selectSurvey` is the cost of that, and it has to be a re-read through the
        // same select rather than a patch of the object in hand: this value reaches
        // `survey-menu-bar.tsx`, whose change detection deep-compares it against the editor's working
        // copy and short-circuits on differing key counts, so the key shape must be identical.
        return tx.survey.findUniqueOrThrow({
          where: { id: surveyId, workspaceId: currentSurvey.workspaceId },
          select: selectSurveyWithCustomCss,
        });
      },
      // Prisma's default interactive-transaction ceiling is 5s, which the write above can plausibly
      // approach on a large survey: it rewrites blocks, follow-ups, triggers and languages, then reads
      // back through `selectSurvey`'s deep select. Failing here loses the author's edit, while the
      // worst a slow commit costs is a held connection — so the timeout is raised rather than left to
      // turn a slow save into a failed one. The reconcile itself adds one indexed read plus a write per
      // changed field.
      { timeout: 20_000, maxWait: 10_000 }
    );

    // ENG-2064: keep feedback-source mappings in sync with the survey's questions. Diff against the
    // blocks that were actually persisted, not the caller's payload — a partial update that omits
    // blocks leaves the stored questions untouched, and diffing its empty payload would delete every
    // mapping. Best-effort: a failure logs inside the helper and never blocks the save.
    await scheduleFeedbackSourceReconciliation(surveyId, currentSurvey.workspaceId, persistedSurvey.blocks);

    if (customCssWrite?.changed) {
      await invalidateCustomCssCaches(currentSurvey.workspaceId);
    }

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

export const updateSurvey = async (
  updatedSurvey: TSurvey,
  options: TUpdateSurveyOptions = {}
): Promise<TSurvey> => {
  return updateSurveyInternal(updatedSurvey, false, options);
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

const attachSurveyCreationFactsToCreateData = (
  data: Omit<Prisma.SurveyCreateInput, "workspace">,
  { ownerId, visibility }: TSurveyCreationFacts
): Omit<Prisma.SurveyCreateInput, "workspace"> => ({
  ...data,
  visibility,
  ownershipInitialized: true,
  ...(ownerId ? { owner: { connect: { id: ownerId } } } : {}),
});

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
  languages: Array<{ language: { id: string } }> | null | undefined,
  client: Prisma.TransactionClient = prisma
): Promise<void> => {
  const languageIds = [...new Set((languages ?? []).map((surveyLanguage) => surveyLanguage.language.id))];
  if (languageIds.length === 0) {
    return;
  }

  // ENG-1749: resolve each language's real owning workspace from the DB rather than trusting the
  // caller-supplied language.workspaceId — the survey payload is client-controlled, so an attacker
  // could otherwise claim a foreign language belongs to this workspace. A single batched query
  // avoids a per-language fan-out; an unknown id is absent from the map and thus rejected.
  const dbLanguages = await client.language.findMany({
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

/**
 * ENG-6870: a survey's responses show who its targeting reached, so a save may only make the targeting
 * read surveys the saver can see. `storedFilters` are the filters the survey is already targeted with:
 * only the surveys `filters` adds to them are checked (`assertAddedSegmentSurveyFiltersVisible`), so
 * saving anything else on a survey an administrator targeted keeps working. A survey pointed at another
 * segment is targeted with that segment's whole tree, so it passes `[]`. Without an actor to check
 * against, a save that needs a check fails closed.
 */
const assertTargetingAddsNoHiddenSurvey = async (
  workspaceId: string,
  filters: TBaseFilters,
  storedFilters: TBaseFilters,
  actor: TSurveyActorContext | undefined,
  segmentId: string
): Promise<void> => {
  // An organization owner or manager sees every survey: nothing to look up.
  if (actor && !buildHiddenSurveyWhere(actor)) return;

  if (!actor) {
    const added = await getAddedSegmentSurveyIds(filters, storedFilters, workspaceId, segmentId);
    if (added.length === 0) return;
    throw new Error(
      "Adding a survey to an app survey's targeting needs the acting user or API key (ENG-6870)"
    );
  }
  await assertAddedSegmentSurveyFiltersVisible(filters, storedFilters, workspaceId, actor, segmentId);
};

/** ENG-6957: a private segment belongs to its own survey, so no other survey may be linked to it. */
const SHARED_SEGMENT_ONLY_MESSAGE = "A survey can only be linked to a shared segment";

/**
 * ENG-6957: whether `segment` is the survey's own private segment: the one it is targeted with, private,
 * and used by no other survey. It is the only segment a survey save writes. A shared segment changes the
 * targeting of every survey that uses it, so it is edited through the segment endpoints, which hold
 * `workspace.write` and check each survey (`updateSegmentAction`).
 */
const isOwnPrivateSegment = (
  survey: Pick<TSurvey, "id" | "segment">,
  segmentId: string
): survey is Pick<TSurvey, "id"> & { segment: NonNullable<TSurvey["segment"]> } =>
  !!survey.segment &&
  survey.segment.id === segmentId &&
  survey.segment.isPrivate &&
  survey.segment.surveys.every((connectedId) => connectedId === survey.id);

/**
 * ENG-6957: an app survey's save, applied to targeting. `segment` comes from the client, so the stored
 * survey decides what it may do, and only this survey's targeting changes:
 * - its own private segment (`isOwnPrivateSegment`): the filters are written;
 * - another segment of the workspace that `segment.surveys` names this survey on: the survey is linked
 *   to it as stored. A private segment belongs to its own survey and is refused;
 * - anything else, its current shared segment included: nothing is written.
 * The other ids in `segment.surveys` are ignored: connecting them would re-point surveys the saver may
 * not write or see. `assertSurveySegmentBelongsToWorkspace` has already checked `segment.id`'s workspace.
 */
const saveAppSurveySegment = async (
  survey: Pick<TSurvey, "id" | "workspaceId" | "segment">,
  segment: NonNullable<TSurvey["segment"]>,
  actor: TSurveyActorContext | undefined
): Promise<void> => {
  // A segment without an id names no stored segment: there is nothing to write or link.
  if (!segment.id) return;

  if (isOwnPrivateSegment(survey, segment.id)) {
    await assertTargetingAddsNoHiddenSurvey(
      survey.workspaceId,
      segment.filters,
      survey.segment.filters,
      actor,
      segment.id
    );
    let written: { count: number };
    try {
      // Only the filters: the title names the survey (`connectOrCreate` finds the segment by it), and a
      // segment is made shared through the segment endpoints. The `where` repeats the ownership check,
      // so a segment shared since the survey was read is left alone.
      written = await prisma.segment.updateMany({
        where: {
          id: segment.id,
          isPrivate: true,
          surveys: { some: { id: survey.id }, every: { id: survey.id } },
        },
        data: { filters: segment.filters },
      });
    } catch (error) {
      logger.error(loggableError(error), "Error updating survey");
      throw new Error("Error updating survey");
    }
    if (written.count === 0) {
      throw new InvalidInputError("The survey's segment changed while saving. Reload and try again.");
    }
    return;
  }

  if (segment.id === survey.segment?.id || !segment.surveys?.includes(survey.id)) return;

  const target = await prisma.segment.findUnique({
    where: { id: segment.id },
    select: { isPrivate: true, filters: true },
  });
  if (!target) throw new ResourceNotFoundError("Segment", segment.id);
  if (target.isPrivate) {
    throw new InvalidInputError(SHARED_SEGMENT_ONLY_MESSAGE);
  }
  await assertTargetingAddsNoHiddenSurvey(
    survey.workspaceId,
    target.filters as TBaseFilters,
    [],
    actor,
    segment.id
  );
  // `isPrivate` and `workspaceId` repeat the checks in the write: a segment that no longer matches fails it.
  await prisma.survey.update({
    where: { id: survey.id },
    data: { segment: { connect: { id: segment.id, isPrivate: false, workspaceId: survey.workspaceId } } },
    select: { id: true },
  });
};

/**
 * ENG-6957: a survey that stops being an app survey leaves the segment it is stored with, whatever segment
 * the client sent. Its private segment is deleted with it, unless another survey still uses it.
 */
const unlinkSurveySegment = async (survey: Pick<TSurvey, "id" | "segment">): Promise<void> => {
  if (!survey.segment) return;
  await prisma.survey.update({
    where: { id: survey.id },
    data: { segment: { disconnect: true } },
    select: { id: true },
  });
  if (survey.segment.isPrivate) {
    await prisma.segment.deleteMany({ where: { id: survey.segment.id, surveys: { none: {} } } });
  }
};

const assertSurveySegmentBelongsToWorkspace = async (
  workspaceId: string,
  segment: { id?: string | null } | null | undefined,
  client: Prisma.TransactionClient = prisma
): Promise<void> => {
  if (!segment?.id) {
    return;
  }

  const existingSegment = await client.segment.findUnique({
    where: { id: segment.id },
    select: { workspaceId: true },
  });

  if (existingSegment?.workspaceId !== workspaceId) {
    throw new ResourceNotFoundError("Segment", segment.id);
  }
};

const toDateOrNull = (value: unknown): Date | null => (value instanceof Date ? value : null);

const buildSurveyLanguagesCreateData = (
  languages: TSurveyCreateInput["languages"]
): Prisma.SurveyLanguageCreateNestedManyWithoutSurveyInput | undefined => {
  if (!languages?.length) {
    return undefined;
  }

  return {
    create: languages.map((surveyLanguage) => ({
      language: {
        connect: {
          id: surveyLanguage.language.id,
        },
      },
      default: surveyLanguage.default,
      enabled: surveyLanguage.enabled,
    })),
  };
};

/**
 * ENG-3228: same refusal as the update path — the legacy projection the read seam will derive
 * from these rows has to be one `ZSurvey` can parse, and a shared entry is canonicalized from its
 * library row first so the projection checked is the one that will actually be derived.
 * `reconcileEmbeddedData` re-runs the link refusals inside the transaction, doing it up front
 * turns a bad link into a 400 rather than a rolled-back create.
 */
const assertCreateEmbeddedFieldsAreStorable = async (
  workspaceId: string,
  embeddedFields: TSurveyCreateInput["embeddedFields"],
  client: Prisma.TransactionClient = prisma
): Promise<void> => {
  if (embeddedFields === undefined) {
    return;
  }

  const desired = await assertLinkableEmbeddedFields(client, {
    workspaceId,
    desired: linkedToDesiredEmbeddedFields(embeddedFields),
  });
  assertDerivedLegacyColumnsAreStorable(toLegacyEmbeddedFields(desired));
};

/** ENG-6870: a new survey's targeting, connected or seeded, may only read surveys its creator can see. */
const assertCreateTargetingVisible = async (
  workspaceId: string,
  segment: { id?: string | null } | null | undefined,
  privateSegmentFilters: TBaseFilters,
  actor: TSurveyActorContext,
  db: Prisma.TransactionClient | typeof prisma
): Promise<void> => {
  if (privateSegmentFilters.length > 0) {
    await assertSegmentSurveyFiltersVisible(privateSegmentFilters, workspaceId, actor);
  }
  if (!segment?.id) return;
  const connected = await db.segment.findUnique({ where: { id: segment.id }, select: { filters: true } });
  if (connected) {
    await assertSegmentSurveyFiltersVisible(
      connected.filters as TBaseFilters,
      workspaceId,
      actor,
      segment.id
    );
  }
};

/** The private targeting segment an app survey is created with, written in the survey's transaction. */
const createPrivateSegmentForSurvey = async (
  tx: Prisma.TransactionClient,
  { surveyId, workspaceId, filters }: { surveyId: string; workspaceId: string; filters: TBaseFilters }
): Promise<void> => {
  const newSegment = await tx.segment.create({
    data: {
      title: surveyId,
      filters,
      isPrivate: true,
      workspace: {
        connect: {
          id: workspaceId,
        },
      },
    },
  });

  await tx.survey.update({
    where: {
      id: surveyId,
    },
    data: {
      segment: {
        connect: {
          id: newSegment.id,
        },
      },
    },
  });
};

export type TCreateSurveyOptions = Readonly<{
  /**
   * ENG-3282: visibility and owner, from `resolveSurveyCreationFacts` — never from the request body,
   * whose schema does not carry them. Required so no creation path can forget it.
   */
  creationFacts: TSurveyCreationFacts;
  privateSegmentFilters?: TBaseFilters;
  /**
   * ENG-6870: who is creating the survey. Its targeting — `privateSegmentFilters`, or the segment the body
   * connects — may only read surveys this actor can see. Required so no creation path can forget it.
   */
  targetingActor: TSurveyActorContext;
  /**
   * ENG-2949: custom CSS already resolved by the shared custom CSS service (plan checked, processed).
   * `ZSurveyCreateInput` strips `customCss` from the body, so this is the only way a create stores it.
   */
  customCss?: TCustomCssStored | null;
  /**
   * ENG-6845: a transaction the caller opened, for a create that must land together with the caller's
   * own writes (an import's References) or not at all. The writes, and the reads of the References the
   * caller may have created in it, go through it; the work this create runs after its commit waits for
   * the caller's — see {@link TSurveyWriteTransaction}.
   * Omitted, the create opens and commits its own transaction, as it always has.
   */
  transaction?: TSurveyWriteTransaction;
}>;

/**
 * A nullable JSON column's value as Prisma writes it: `null` is stored as SQL NULL (`Prisma.DbNull`).
 * Not `??`: `undefined` must stay `undefined`, which leaves the column to its default.
 */
const toNullableJsonColumn = <T>(value: T | null): T | typeof Prisma.DbNull => {
  if (value === null) return Prisma.DbNull;
  return value;
};

export const createSurvey = async (
  workspaceId: string,
  surveyBody: TSurveyCreateInput,
  { creationFacts, privateSegmentFilters = [], customCss, transaction, targetingActor }: TCreateSurveyOptions
): Promise<TSurvey> => {
  const [parsedWorkspaceId, parsedSurveyBody] = validateInputs(
    [workspaceId, ZId],
    [surveyBody, ZSurveyCreateInput]
  );

  try {
    const {
      createdBy,
      languages,
      segment,
      followUps,
      styling,
      // ENG-3228: accepted input, but never spread into Prisma — `Survey` owns relations named
      // `embeddedData` / `embeddedDataLinks`, so it would become a nested relation write. It reaches
      // the database as the rows `reconcileEmbeddedData` writes. ENG-2404: so do the two legacy
      // keys, which have no column to spread into any more.
      embeddedFields,
      variables,
      hiddenFields,
      ...restSurveyBody
    } = parsedSurveyBody;
    // Under a caller's transaction, the reads below have to see what it already wrote: an import creates
    // the languages, action classes and shared fields this survey points at in that same transaction.
    const db = transaction?.tx ?? prisma;
    await assertSurveyLanguagesBelongToWorkspace(parsedWorkspaceId, languages, db);
    await assertSurveySegmentBelongsToWorkspace(parsedWorkspaceId, segment, db);
    await assertCreateTargetingVisible(parsedWorkspaceId, segment, privateSegmentFilters, targetingActor, db);

    // ENG-1839: `existing` is empty because a create authors every name fresh — there is nothing to
    // grandfather yet. Covers templates, `POST /api/v1/management/surveys` and the v3 create route.
    // The survey COPY flow does its own `tx.survey.create` and never reaches here, which is what
    // keeps duplicating a survey that already declares `country` working.
    assertValidNewDeclaredFields({ existing: {}, incoming: parsedSurveyBody });

    await assertCreateEmbeddedFieldsAreStorable(parsedWorkspaceId, embeddedFields, db);

    // An app survey can never be shown without a trigger, so block creating one directly in a
    // non-draft status with zero triggers (mirrors the editor's publish guard). No creative can open a
    // survey that doesn't exist yet.
    if (
      isAppSurveyMissingTriggersToPublish({
        type: restSurveyBody.type ?? "link",
        status: restSurveyBody.status ?? "draft",
        triggers: restSurveyBody.triggers,
        isOpenedByCreative: false,
      })
    ) {
      throw new InvalidInputError(APP_SURVEY_TRIGGER_REQUIRED_MESSAGE);
    }
    const normalizedCloseOn = toDateOrNull(restSurveyBody.closeOn);
    const normalizedPublishOn = toDateOrNull(restSurveyBody.publishOn);
    const actionClasses = transaction
      ? await getActionClassesInTransaction(transaction.tx, parsedWorkspaceId)
      : await getActionClasses(parsedWorkspaceId);

    const baseData = {
      ...restSurveyBody,
      ...(restSurveyBody.blocks
        ? { blocks: fillSurveyBlockCodes(restSurveyBody.blocks, parsedSurveyBody) }
        : {}),
      styling: styling === null ? Prisma.JsonNull : styling,
      showConditions: toNullableJsonColumn(restSurveyBody.showConditions),
      startLogic: toNullableJsonColumn(restSurveyBody.startLogic),
      ...normalizeSurveyScheduling({
        closeOn: normalizedCloseOn,
        publishOn: normalizedPublishOn,
        status: restSurveyBody.status ?? "draft",
      }),
      languages: buildSurveyLanguagesCreateData(languages),
      segment: segment?.id ? { connect: { id: segment.id } } : undefined,
      triggers: restSurveyBody.triggers
        ? handleTriggerUpdates(restSurveyBody.triggers, [], actionClasses)
        : undefined,
      attributeFilters: undefined,
    } as Omit<Prisma.SurveyCreateInput, "workspace">;
    const data = validateSurveyCreateDataMedia(
      attachSurveyFollowUpsToCreateData(
        attachSurveyCreationFactsToCreateData(
          attachSurveyCreatorToCreateData(baseData, createdBy),
          creationFacts
        ),
        followUps
      )
    );

    const organization = await getOrganizationByWorkspaceId(parsedWorkspaceId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", null);
    }

    // Create the survey and — for app surveys — its private targeting segment atomically. The survey,
    // the segment (seeded with any caller-supplied filters), and the segment connection must all land
    // or none, so a mid-write failure can't leave a survey with missing or partial targeting.
    const writeSurvey = async (tx: Prisma.TransactionClient) => {
      const createdSurvey = await tx.survey.create({
        data: {
          ...data,
          ...(customCss ? { customCss } : {}),
          workspace: {
            connect: {
              id: parsedWorkspaceId,
            },
          },
        },
        select: selectSurvey,
      });

      if (createdSurvey.type === "app") {
        await createPrivateSegmentForSurvey(tx, {
          surveyId: createdSurvey.id,
          workspaceId: parsedWorkspaceId,
          filters: privateSegmentFilters,
        });
      }

      // ENG-1978: a survey created from a template, the API or a duplicate can already carry
      // variables and hidden fields, so the tables have to be populated at creation, not just on the
      // next save. From the payload (ENG-2404): the rows are the only thing this create stores
      // them in. ENG-3228: a payload that declared its fields as rows takes that branch instead.
      await reconcileEmbeddedData(tx, {
        surveyId: createdSurvey.id,
        workspaceId: parsedWorkspaceId,
        // `validateInputs` types its result as the schema's input, where a variable's `value` is
        // optional; `ZSurveyCreateInput` has already applied its prefault, so every one is set.
        patch: { variables: variables as TSurveyVariables | undefined, hiddenFields, embeddedFields },
      });

      // Re-read after the reconcile, not before it. `createdSurvey` was selected before the links
      // existed, so its `embeddedDataLinks` is empty — and since ENG-2412 removed the legacy
      // fallback, returning it would report a freshly created survey as having no Embedded Data at
      // all. Cheap here in a way it would not be on the editor-save path: creation happens once per
      // survey, and this also picks up the private-segment connect above, which `createdSurvey`
      // predates.
      return tx.survey.findUniqueOrThrow({
        where: { id: createdSurvey.id },
        select: selectSurveyWithCustomCss,
      });
    };

    const survey = transaction
      ? await writeSurvey(transaction.tx)
      : await prisma.$transaction(
          writeSurvey,
          // This transaction predates ENG-1978, but the reconcile in it adds a read plus two writes per
          // field, and neither `variables` nor `hiddenFields` is bounded — so a large template or API
          // create could now reach Prisma's 5s default where it used to fit. Matched to the other
          // reconcile call sites (a `reconcileEmbeddedData(` grep enumerates them) rather than left to
          // inherit a ceiling this work made easier to hit.
          SURVEY_WRITE_TRANSACTION_OPTIONS
        );

    // TODO: Fix this, this happens because the survey type "web" is no longer in the zod types but its required in the schema for migration
    // @ts-expect-error
    const transformedSurvey: TSurvey = {
      // ENG-1837: this result is hand-built rather than routed through `transformPrismaSurvey`, so
      // the inlining has to happen here too — otherwise the raw relation leaks onto TSurvey. The
      // rows are read back after the reconcile (see the transaction's return), so this list carries
      // the definitions that were just written.
      ...withInlinedEmbeddedFields(survey),
      ...(survey.segment && {
        segment: {
          ...survey.segment,
          surveys: survey.segment.surveys.map((survey) => survey.id),
        },
      }),
    };

    const finishAfterCommit = async (): Promise<TSurvey> => {
      const reconciledSurvey = await reconcilePersistedSurveySchedulingIfDue({
        logSource: "survey-create",
        survey: transformedSurvey,
        workspaceId: parsedWorkspaceId,
      });

      if (createdBy) {
        await subscribeOrganizationMembersToSurveyResponses(reconciledSurvey.id, createdBy, organization.id);
      }

      return reconciledSurvey;
    };

    if (transaction) {
      transaction.afterCommit(finishAfterCommit);
      return transformedSurvey;
    }

    try {
      return await finishAfterCommit();
    } catch (error) {
      // The survey has committed: a caller must not answer this as nothing created, nor retry it.
      throw new SurveyWriteAfterCommitError(transformedSurvey, error);
    }
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

    // ENG-6957: a private segment belongs to its own survey. Linking another survey to it would let that
    // survey read its targeting, and would stop its own survey's saves from writing it.
    if (newSegment.isPrivate && newSegment.id !== currentSurveySegment?.id) {
      throw new InvalidInputError(SHARED_SEGMENT_ONLY_MESSAGE);
    }

    const prismaSurvey = await prisma.survey.update({
      where: {
        id: surveyId,
      },
      select: selectSurvey,
      data: {
        segment: {
          // `isPrivate: false` repeats the check in the write, unless the survey keeps its own segment.
          connect:
            newSegment.id === currentSurveySegment?.id
              ? { id: newSegmentId }
              : { id: newSegmentId, isPrivate: false, workspaceId: currentSurvey.workspaceId },
        },
      },
    });

    if (
      currentSurveySegment &&
      currentSurveySegment.id !== newSegmentId &&
      currentSurveySegment.isPrivate &&
      currentSurveySegment.title === currentSurvey.id
    ) {
      // Only once no survey uses it any more (ENG-6957).
      await prisma.segment.deleteMany({
        where: { id: currentSurveySegment.id, isPrivate: true, surveys: { none: {} } },
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
