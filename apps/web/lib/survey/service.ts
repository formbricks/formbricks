import "server-only";
import { isDeepStrictEqual } from "node:util";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma, type Survey as TPrismaSurveyRow } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
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
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
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
  checkReferencedSegmentsForRecursion,
  getAddedSegmentSurveyIds,
} from "@/modules/ee/contacts/segments/lib/helper";
import {
  assertNoLinkedCreatives,
  getDestinationSettingTurnedOn,
} from "@/modules/ee/creatives/lib/linked-creatives";
import { isAppSurveyBlockedFromPublishing } from "@/modules/ee/creatives/lib/survey-publish";
import { getIsContactsEnabled, getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
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

/** ENG-7127: what a survey save does with a key of its payload; see `SURVEY_SAVE_KEYS`. */
type TSurveySaveKeyRole = "column" | "handler" | "derived" | "serverOwned";

/**
 * ENG-7127: what a survey save does with each key of its payload. The update `data` is built from the
 * `column` keys and the handlers in `updateSurveyInternal` only, never by spreading the payload: the
 * draft save's schema used to keep unknown keys, and a spread passed Prisma relation writes
 * (`workspace`, `creator`, `owner`, `responses`, …) and raw foreign keys (`segmentId`) straight to
 * `tx.survey.update`, writing rows outside the survey.
 *
 * - `column`: copied from the payload as given.
 * - `handler`: written by its own code, which checks the ids: segment, languages, triggers and
 *   follow-ups below, Embedded Data through `reconcileEmbeddedData`, custom CSS through the custom CSS
 *   service (ENG-2949), and `questions`, stripped of `isDraft`.
 * - `derived`: set by the save itself.
 * - `serverOwned`: never written by a save. `archivedAt` belongs to archive and restore; the visibility
 *   facts to the visibility endpoint, under the per-survey lock (ENG-3282).
 *
 * Every key of `TSurvey` must be listed, so a new survey field fails to compile until it is given one.
 */
const SURVEY_SAVE_KEYS = {
  name: "column",
  status: "column",
  displayOption: "column",
  autoClose: "column",
  keepEndingCardOpen: "column",
  recontactDays: "column",
  displayLimit: "column",
  welcomeCard: "column",
  blocks: "column",
  endings: "column",
  delay: "column",
  autoComplete: "column",
  workspaceOverwrites: "column",
  styling: "column",
  showLanguageSwitch: "column",
  autoSelectLanguage: "column",
  surveyClosedMessage: "column",
  singleUse: "column",
  isVerifyEmailEnabled: "column",
  recaptcha: "column",
  isBackButtonHidden: "column",
  isAutoProgressingEnabled: "column",
  isCaptureIpEnabled: "column",
  isAnonymizeResponsesEnabled: "column",
  pin: "column",
  displayPercentage: "column",
  metadata: "column",
  slug: "column",
  customHeadScripts: "column",
  customHeadScriptsMode: "column",
  showConditions: "column",
  startLogic: "column",
  type: "column",
  questions: "handler",
  triggers: "handler",
  segment: "handler",
  languages: "handler",
  followUps: "handler",
  embeddedFields: "handler",
  variables: "handler",
  hiddenFields: "handler",
  customCss: "handler",
  updatedAt: "derived",
  publishOn: "derived",
  closeOn: "derived",
  id: "serverOwned",
  workspaceId: "serverOwned",
  createdAt: "serverOwned",
  createdBy: "serverOwned",
  archivedAt: "serverOwned",
  visibility: "serverOwned",
  ownerId: "serverOwned",
  visibilityVersion: "serverOwned",
  visibilityProjectedVersion: "serverOwned",
  visibilityChangedAt: "serverOwned",
  visibilityChangedById: "serverOwned",
} as const satisfies Record<keyof TSurvey, TSurveySaveKeyRole>;

type TSurveySaveColumn = {
  [K in keyof typeof SURVEY_SAVE_KEYS]: (typeof SURVEY_SAVE_KEYS)[K] extends "column" ? K : never;
}[keyof typeof SURVEY_SAVE_KEYS];

/**
 * A `column` must be a plain column: a field of the `Survey` row, which has no relations, that
 * `Prisma.SurveyUpdateInput` also takes, which has no foreign keys. A relation or foreign key marked
 * `column` fails to compile here.
 */
const asSurveyUpdateColumns = <K extends keyof TPrismaSurveyRow & keyof Prisma.SurveyUpdateInput>(
  columns: K[]
): readonly K[] => columns;

const SURVEY_SAVE_COLUMNS = asSurveyUpdateColumns<TSurveySaveColumn>(
  (Object.keys(SURVEY_SAVE_KEYS) as (keyof typeof SURVEY_SAVE_KEYS)[]).filter(
    (key): key is TSurveySaveColumn => SURVEY_SAVE_KEYS[key] === "column"
  )
);

/** ENG-7127: the payload's values for the `column` keys of `SURVEY_SAVE_KEYS`, and nothing else from it. */
const pickSurveySaveColumns = (survey: TSurvey): Partial<Pick<TSurvey, TSurveySaveColumn>> => {
  const columns: Partial<Record<TSurveySaveColumn, unknown>> = {};
  for (const column of SURVEY_SAVE_COLUMNS) {
    if (Object.hasOwn(survey, column)) columns[column] = survey[column];
  }
  return columns as Partial<Pick<TSurvey, TSurveySaveColumn>>;
};

/** Whether the workspace's organization is licensed for quotas; a workspace with none is not. */
const getIsQuotasEnabledForWorkspace = async (workspaceId: string): Promise<boolean> => {
  const organization = await getOrganizationByWorkspaceId(workspaceId);
  return organization ? getIsQuotasEnabled(organization.id) : false;
};

/** Every segment id named by a (possibly half-built) filter tree, read without assuming its shape. */
const collectReferencedSegmentIds = (node: unknown, found: Set<string> = new Set()): Set<string> => {
  // Iterative: the draft save bounds the tree's arrays, but not a chain of `resource` objects, and a
  // recursive walk would overflow its stack before anything else ran.
  const pending: unknown[] = [node];
  while (pending.length > 0) {
    const current = pending.pop();
    if (Array.isArray(current)) {
      for (const child of current) pending.push(child);
    } else if (current && typeof current === "object") {
      const { root, resource } = current as {
        root?: { type?: unknown; segmentId?: unknown };
        resource?: unknown;
      };
      if (root?.type === "segment" && typeof root.segmentId === "string") found.add(root.segmentId);
      if (resource) pending.push(resource);
    }
  }
  return found;
};

const assertContactsLicence = async (workspaceId: string): Promise<void> => {
  const organization = await getOrganizationByWorkspaceId(workspaceId);
  if (!organization) throw new ResourceNotFoundError("Workspace", workspaceId);
  if (!(await getIsContactsEnabled(organization.id))) {
    throw new OperationNotAllowedError("Advanced targeting is not allowed for this organization");
  }
};

/**
 * ENG-7267: the segment endpoints and the v3 survey writes refuse advanced targeting without the
 * Contacts licence and filters that name their own segment; a survey save applies targeting too, so it
 * holds the same rules on what `saveAppSurveySegment` will actually apply (ENG-6957):
 * - the survey's own private segment: the raw filter tree it writes (a draft save skips the schema, so a
 *   tree that fails it must not slip past). The licence is asked only when the filters change, so a
 *   survey keeps saving after its organization's licence lapses;
 * - linking another segment: checked in `saveAppSurveySegment`'s link branch, on that segment's stored
 *   filters, which the survey takes on whatever filters the client sent;
 * - anything else writes no targeting, so it is not checked.
 */
/** The incoming segment of an app survey save; the draft path does not type its filters. */
type TAppTargetingSegment = { id?: string | null; filters?: unknown } | null | undefined;
type TTargetingSurveyField = "id" | "workspaceId" | "segment";
type TTargetingSurvey = Pick<TSurvey, TTargetingSurveyField>;

const assertAppTargetingFiltersAllowed = async (
  currentSurvey: TTargetingSurvey,
  segment: TAppTargetingSegment
): Promise<void> => {
  if (!segment?.id) return;

  if (isOwnPrivateSegment(currentSurvey, segment.id)) {
    const filters = segment.filters;
    if (filters === undefined) return;
    // A draft save skips the schema, so the shape is only what the client sent. A null or non-array would
    // be written raw and break consumers that iterate it, so both are refused here.
    if (!Array.isArray(filters)) throw new InvalidInputError("Invalid user segment filters");
    if (filters.length === 0) return;
    // The draft save skips the schema, so the recursive walk below can meet any depth. Bounds first, as in
    // `updateAppSurveySegment`: a tree too deep must be refused by the iterative measure, not overflow the
    // walk's call stack.
    const boundsViolation = getSegmentFilterTreeBoundsViolation(filters);
    if (boundsViolation) throw new InvalidInputError(boundsViolation);
    const referenced = collectReferencedSegmentIds(filters);
    if (referenced.has(segment.id)) {
      throw new InvalidInputError("Recursive segment filter is not allowed");
    }
    // The draft tree can fail the schema and still name other segments, so follow the raw ids: an indirect
    // recursion must be refused before `saveAppSurveySegment` writes the tree it takes on.
    await checkReferencedSegmentsForRecursion(referenced, segment.id, currentSurvey.workspaceId);
    if (isDeepStrictEqual(filters, currentSurvey.segment.filters ?? [])) return;
    await assertContactsLicence(currentSurvey.workspaceId);
  }
};

/** Archived surveys are read-only, and a published one keeps its locked parts (ENG-6783). */
const assertSurveyIsEditable = (currentSurvey: TSurvey, updatedSurvey: TSurvey): void => {
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
};

/** Every Embedded Data refusal a save can meet, raised before anything is written. */
const assertEmbeddedFieldsAreStorable = async (
  embeddedFields: NonNullable<TSurvey["embeddedFields"]>,
  workspaceId: string
): Promise<void> => {
  const declared = linkedToDesiredEmbeddedFields(embeddedFields);
  assertWritableEmbeddedFields(declared);
  // Shared entries come back carrying the library's own definition rather than the payload's
  // claim about it, so the projection checked below is the one the read seam will derive.
  const desired = await assertLinkableEmbeddedFields(prisma, {
    workspaceId: workspaceId,
    desired: declared,
  });
  assertDerivedLegacyColumnsAreStorable(toLegacyEmbeddedFields(desired));
};

/**
 * The checks a save must pass before it writes: draft-only skipped validation, and, when validating,
 * question images, an app survey's way to open, and block media.
 */
const assertUpdateCanBeSaved = async ({
  skipValidation,
  currentSurvey,
  updatedSurvey,
}: {
  skipValidation: boolean;
  currentSurvey: TSurvey;
  updatedSurvey: TSurvey;
}): Promise<void> => {
  const { id: surveyId, questions, type, triggers } = updatedSurvey;
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
};

/** The custom CSS write a save makes, decided against the stored row; null when the payload has none. */
const resolveSurveyCustomCssWrite = async (
  customCss: TSurvey["customCss"],
  currentSurvey: TSurvey,
  options: TUpdateSurveyOptions
) => {
  const surveyId = currentSurvey.id;
  const customCssSource = readCustomCssPayloadSource(customCss);
  return customCssSource === undefined
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
};

/** The `languages` update: default and enabled flags, links to add, links to remove. */
const buildSurveyLanguagesUpdate = (
  currentSurvey: TSurvey,
  updatedSurvey: TSurvey,
  languages: TSurvey["languages"]
): Record<string, unknown> => {
  // Extract currentLanguageIds and updatedLanguageIds
  const currentLanguageIds = currentSurvey.languages ? currentSurvey.languages.map((l) => l.language.id) : [];
  const updatedLanguageIds = languages.length > 0 ? updatedSurvey.languages.map((l) => l.language.id) : [];
  const enabledLanguageIds = languages
    .filter((language) => language.enabled)
    .map((language) => language.language.id);

  // Determine languages to add and remove
  const languagesToAdd = updatedLanguageIds.filter((id) => !currentLanguageIds.includes(id));
  const languagesToRemove = currentLanguageIds.filter((id) => !updatedLanguageIds.includes(id));

  const defaultLanguageId = updatedSurvey.languages.find((l) => l.default)?.language.id;

  // Prepare data for Prisma update
  const languagesUpdate: Record<string, unknown> = {};

  // Update existing languages for default value changes
  languagesUpdate.updateMany = currentSurvey.languages.map((surveyLanguage) => ({
    where: { languageId: surveyLanguage.language.id },
    data: {
      default: surveyLanguage.language.id === defaultLanguageId,
      enabled: enabledLanguageIds.includes(surveyLanguage.language.id),
    },
  }));

  // Add new languages
  if (languagesToAdd.length > 0) {
    languagesUpdate.create = languagesToAdd.map((languageId) => ({
      languageId: languageId,
      default: languageId === defaultLanguageId,
      enabled: enabledLanguageIds.includes(languageId),
    }));
  }

  // Remove languages no longer associated with the survey
  if (languagesToRemove.length > 0) {
    languagesUpdate.deleteMany = languagesToRemove.map((languageId) => ({ languageId }));
  }

  return languagesUpdate;
};

/** An app survey's segment, written outside the transaction: validated here, applied by `saveAppSurveySegment`. */
const updateAppSurveySegment = async (
  segment: NonNullable<TSurvey["segment"]>,
  currentSurvey: TSurvey,
  skipValidation: boolean,
  options: TUpdateSurveyOptions
): Promise<void> => {
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
};

/** An app survey without a segment gets its own private one. */
const ensureAppSurveySegment = async (currentSurvey: TSurvey, surveyId: string): Promise<void> => {
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
};

/**
 * ENG-6957: the save changes this survey's targeting only. An app survey writes its own private segment
 * or links itself to a shared one; any other survey leaves its stored segment, and its private segment is
 * deleted unless another survey still uses it.
 */
const applySurveySegmentChanges = async ({
  segment,
  type,
  currentSurvey,
  skipValidation,
  options,
}: {
  segment: TSurvey["segment"];
  type: TSurvey["type"];
  currentSurvey: TSurvey;
  skipValidation: boolean;
  options: TUpdateSurveyOptions;
}): Promise<void> => {
  if (type !== "app") {
    await unlinkSurveySegment(currentSurvey);
  } else if (segment) {
    await updateAppSurveySegment(segment, currentSurvey, skipValidation, options);
  } else {
    await ensureAppSurveySegment(currentSurvey, currentSurvey.id);
  }
};

/** The `followUps` update: edits, new ones, and the ones marked deleted. */
const buildSurveyFollowUpsUpdate = (followUps: TSurvey["followUps"], currentSurvey: TSurvey) => {
  // Separate follow-ups into categories based on deletion flag
  const deletedFollowUps = followUps.filter((followUp) => followUp.deleted);
  const nonDeletedFollowUps = followUps.filter((followUp) => !followUp.deleted);

  // Get set of existing follow-up IDs from currentSurvey
  const existingFollowUpIds = new Set(currentSurvey.followUps.map((f) => f.id));

  // Separate non-deleted follow-ups into new and existing
  const existingFollowUps = nonDeletedFollowUps.filter((followUp) => existingFollowUpIds.has(followUp.id));
  const newFollowUps = nonDeletedFollowUps.filter((followUp) => !existingFollowUpIds.has(followUp.id));

  return {
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
};

/**
 * The survey row's write: the save columns and the relation updates built so far, then follow-ups,
 * questions and blocks without their draft flags, the normalized schedule and the custom CSS.
 */
const buildSurveyWriteData = ({
  data,
  updatedSurvey,
  currentSurvey,
  customCssWrite,
}: {
  data: Record<string, unknown>;
  updatedSurvey: TSurvey;
  currentSurvey: TSurvey;
  customCssWrite: Awaited<ReturnType<typeof resolveSurveyCustomCssWrite>>;
}): Record<string, unknown> => {
  const { followUps, questions } = updatedSurvey;
  if (followUps) {
    data.followUps = buildSurveyFollowUpsUpdate(followUps, currentSurvey);
  }

  data.questions = questions.map((question) => {
    const { isDraft: _isDraft, ...rest } = question;
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
    closeOn: updatedSurvey.closeOn,
    publishOn: updatedSurvey.publishOn,
    status: updatedSurvey.status,
  });

  const writeData: Record<string, unknown> = {
    ...pickSurveySaveColumns(updatedSurvey),
    ...data,
    updatedAt: new Date(),
    publishOn: normalizedScheduling.publishOn,
    closeOn: normalizedScheduling.closeOn,
  };

  if (customCssWrite?.changed) {
    writeData.customCss = customCssWrite.stored ?? Prisma.DbNull;
  }

  // A nullable JSON column takes `Prisma.DbNull`, not `null`, to store "no conditions".
  if (writeData.showConditions === null) {
    writeData.showConditions = Prisma.DbNull;
  }
  if (writeData.startLogic === null) {
    writeData.startLogic = Prisma.DbNull;
  }

  return writeData;
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
    let data: Prisma.SurveyUpdateInput = {};

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

    assertSurveyIsEditable(currentSurvey, updatedSurvey);

    // ENG-1749: workspaceId and id are the survey's tenant anchors. Always resolve the workspace from
    // the existing survey (never the client payload), and strip workspaceId/id from the update below,
    // so an authorized editor cannot re-point their own survey into another workspace/organization.
    const actionClasses = await getActionClasses(currentSurvey.workspaceId);

    // ENG-7127: only these keys are read from the payload, each by its own handler below; the scalar
    // columns come from `pickSurveySaveColumns`. Nothing else in the payload reaches the write.
    // ENG-3228/ENG-2404: Embedded Data reaches the rows through `reconcileEmbeddedData` alone, and
    // ENG-2949: custom CSS through the shared custom CSS service, so a caller's compiled CSS or
    // processor version is never stored.
    const { triggers, segment, languages, type, embeddedFields, variables, hiddenFields, customCss } =
      updatedSurvey;

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
      await assertEmbeddedFieldsAreStorable(embeddedFields, currentSurvey.workspaceId);
    }

    // ENG-1749 sibling: an app save acts on segment.id. Ensure the segment belongs to this survey's
    // workspace so a caller cannot touch another tenant's segment by supplying its id. Mirrors the
    // create path guard. Any other save ignores segment.id and unlinks the stored segment (ENG-6957).
    if (updatedSurvey.type === "app") {
      await assertSurveySegmentBelongsToWorkspace(currentSurvey.workspaceId, segment);
      // ENG-7267: an app save may not add attribute filters without the contacts licence, nor a
      // self-referencing segment.
      await assertAppTargetingFiltersAllowed(currentSurvey, segment);
    }

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
    //     `status` is one of `SURVEY_SAVE_COLUMNS`, so it flows straight to the write.
    // Deliberately placed after the ENG-1749 tenant guards so a cross-workspace attempt still reports
    // the authorization failure first, and before prisma.survey.update so nothing is persisted. The
    // write repeats the stored-status half of this condition (see `tx.survey.update`): this read is
    // outside the transaction, so a publish that commits in between is not seen here, and the in-flight
    // draft save would otherwise revert the published survey to draft.
    await assertUpdateCanBeSaved({ skipValidation, currentSurvey, updatedSurvey });

    // ENG-2949: custom CSS is decided before anything is written — the segment block below writes
    // outside the transaction, so a refusal raised later would half-apply the save. Full-object payloads
    // (the editor's save and autosave) are revalidated from source against the stored row: unchanged
    // source costs no plan check and no processing, removal needs no plan, and an addition or edit needs
    // the plan, a unit of the custom CSS budget and a clean processor run. Failures keep the stored
    // revision.
    const customCssWrite = await resolveSurveyCustomCssWrite(customCss, currentSurvey, options);

    if (languages) {
      data.languages = buildSurveyLanguagesUpdate(currentSurvey, updatedSurvey, languages);
    }

    if (triggers) {
      data.triggers = handleTriggerUpdates(triggers, currentSurvey.triggers, actionClasses);
    }

    await applySurveySegmentChanges({ segment, type, currentSurvey, skipValidation, options });

    data = buildSurveyWriteData({ data, updatedSurvey, currentSurvey, customCssWrite });

    // ENG-6934: the quotas' matrix conditions follow a row or column reorder only where quotas are
    // licensed, as every other quota write is. The license is resolved here, outside the transaction.
    const syncsQuotaMatrix =
      Array.isArray(data.blocks) &&
      hasMatrixElement(data.blocks) &&
      (await getIsQuotasEnabledForWorkspace(currentSurvey.workspaceId));

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
        //
        // ENG-1939 at the write: the guard above reads the stored status before the transaction opens,
        // so a publish committing in between passes it. Under `skipValidation` the payload status is
        // always "draft", so requiring the same of the row makes this a compare-and-set: the publish
        // wins and this save matches no row (P2025) instead of reverting it. `archivedAt: null` closes
        // the same window on the guard's archived check — archiving a draft keeps its status, so the
        // status predicate alone would still match. That P2025 is the guard's own refusal, not a
        // database failure — the outer catch would otherwise report a 500. It also covers the row being
        // deleted in the same window, which shares this refusal because none of the cases match the
        // predicate. Like `assertNoLinkedCreatives` above, this refusal comes after the segment writes,
        // which run outside this transaction and stay committed when it fires. Those writes can update
        // the segment's filters, link the survey to a segment, or disconnect and delete its private
        // segment on a type change, so a save that loses the race still changes the targeting of a
        // survey that is now published or archived.
        try {
          await tx.survey.update({
            where: skipValidation
              ? { id: surveyId, workspaceId: currentSurvey.workspaceId, status: "draft", archivedAt: null }
              : { id: surveyId, workspaceId: currentSurvey.workspaceId },
            data,
            select: { id: true },
          });
        } catch (error) {
          if (
            skipValidation &&
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === PrismaErrorType.RecordNotFound
          ) {
            throw new OperationNotAllowedError("Only draft surveys can be updated without validation");
          }

          throw error;
        }

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

/**
 * `createdBy` is attribution, but it is written as a relation to any user id and then gets the survey
 * added to that user's notification settings. A caller could therefore attribute a survey to someone
 * from another organization (leaking their name in the survey list), so it has to be a member of the
 * organization the survey is created in.
 */
const assertSurveyCreatorIsOrganizationMember = async (
  createdBy: string,
  organizationId: string,
  tx?: Prisma.TransactionClient
): Promise<void> => {
  if (!(await getMembershipByUserIdOrganizationId(createdBy, organizationId, tx))) {
    throw new InvalidInputError("createdBy must be a member of this organization");
  }
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
      blocks: validateMediaAndPrepareBlocks(data.blocks),
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
 * ENG-6957: a save refuses to act on a segment that changed since the survey was read. A 409: the request
 * is fine, the survey's state moved under it. Listed in `EXPECTED_ERROR_NAMES`, so server actions and the
 * v1 API surface its message.
 */
export class SurveySegmentChangedError extends Error {
  readonly statusCode = 409;

  constructor() {
    super("The survey's segment changed while saving. Reload and try again.");
    this.name = "SurveySegmentChangedError";
  }
}

/**
 * ENG-6957: whether `segment` is the survey's own private segment: the one it is targeted with, private,
 * and used by no other survey. It is the only segment a survey save writes. A shared segment changes the
 * targeting of every survey that uses it, so it is edited through the segment endpoints, which hold
 * `workspace.write` and check each survey (`PATCH /api/internal/segments/{segmentId}`).
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
          workspaceId: survey.workspaceId,
          isPrivate: true,
          surveys: { some: { id: survey.id }, every: { id: survey.id } },
          // The filters the visibility check compared against: a segment changed since is left alone.
          filters: { equals: survey.segment.filters as unknown as Prisma.InputJsonValue },
        },
        data: { filters: segment.filters },
      });
    } catch (error) {
      logger.error(loggableError(error), "Error updating survey");
      throw new Error("Error updating survey");
    }
    if (written.count === 0) {
      throw new SurveySegmentChangedError();
    }
    return;
  }

  if (segment.id === survey.segment?.id || !segment.surveys?.includes(survey.id)) return;

  const target = await prisma.segment.findFirst({
    where: { id: segment.id, workspaceId: survey.workspaceId },
    select: { isPrivate: true, filters: true },
  });
  if (!target) throw new ResourceNotFoundError("Segment", segment.id);
  if (target.isPrivate) {
    throw new InvalidInputError(SHARED_SEGMENT_ONLY_MESSAGE);
  }
  // ENG-7267: the survey takes on the segment's stored filters, so attribute targeting needs the Contacts
  // licence here, whatever filters the client sent with the link.
  if (Array.isArray(target.filters) && target.filters.length > 0) {
    await assertContactsLicence(survey.workspaceId);
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
    where: { id: survey.id, workspaceId: survey.workspaceId },
    data: { segment: { connect: { id: segment.id, isPrivate: false, workspaceId: survey.workspaceId } } },
    select: { id: true },
  });
};

/**
 * ENG-6957: a survey that stops being an app survey leaves the segment it is stored with, whatever segment
 * the client sent. Its private segment is deleted with it, unless another survey still uses it.
 */
const unlinkSurveySegment = async (
  survey: Pick<TSurvey, "id" | "workspaceId" | "segment">
): Promise<void> => {
  if (!survey.segment) return;
  // Only while the survey is still on the segment it was read with.
  const unlinked = await prisma.survey.updateMany({
    where: { id: survey.id, workspaceId: survey.workspaceId, segmentId: survey.segment.id },
    data: { segmentId: null },
  });
  if (unlinked.count === 0) {
    throw new SurveySegmentChangedError();
  }
  if (survey.segment.isPrivate) {
    // `isPrivate` again: a segment made shared since the survey was read is kept.
    await prisma.segment.deleteMany({
      where: {
        id: survey.segment.id,
        workspaceId: survey.workspaceId,
        isPrivate: true,
        surveys: { none: {} },
      },
    });
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

    if (createdBy) {
      await assertSurveyCreatorIsOrganizationMember(createdBy, organization.id, transaction?.tx);
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
    // @ts-expect-error -- the Prisma row still carries the legacy "web" survey type (see the TODO above)
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

    // Re-loading the survey's current segment changes nothing (ENG-6957).
    if (currentSurveySegment?.id === newSegmentId) {
      return currentSurvey;
    }

    const newSegment = await prisma.segment.findFirst({
      where: { id: newSegmentId, workspaceId: currentSurvey.workspaceId },
      select: { isPrivate: true },
    });

    if (!newSegment) {
      throw new ResourceNotFoundError("segment", newSegmentId);
    }

    // ENG-6957: a private segment belongs to its own survey. Linking another survey to it would let that
    // survey read its targeting, and would stop its own survey's saves from writing it.
    if (newSegment.isPrivate) {
      throw new InvalidInputError(SHARED_SEGMENT_ONLY_MESSAGE);
    }

    const prismaSurvey = await prisma.survey.update({
      where: { id: surveyId, workspaceId: currentSurvey.workspaceId },
      select: selectSurvey,
      data: {
        segment: {
          // `isPrivate` and `workspaceId` repeat the checks in the write.
          connect: { id: newSegmentId, isPrivate: false, workspaceId: currentSurvey.workspaceId },
        },
      },
    });

    if (currentSurveySegment?.isPrivate && currentSurveySegment.title === currentSurvey.id) {
      // Only once no survey uses it any more (ENG-6957).
      await prisma.segment.deleteMany({
        where: {
          id: currentSurveySegment.id,
          workspaceId: currentSurvey.workspaceId,
          isPrivate: true,
          surveys: { none: {} },
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
