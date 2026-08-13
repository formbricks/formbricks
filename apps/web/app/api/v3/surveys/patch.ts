import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { toDesiredEmbeddedFields } from "@formbricks/types/embedded-data-mapping";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getActionClasses } from "@/lib/actionClass/service";
import { reconcileEmbeddedData } from "@/lib/embedded-data/reconcile";
import { selectSurvey } from "@/lib/survey/service";
import {
  APP_SURVEY_TRIGGER_REQUIRED_MESSAGE,
  isAppSurveyMissingTriggersToPublish,
  stripIsDraftFromBlocks,
  transformPrismaSurvey,
} from "@/lib/survey/utils";
import { handleTriggerUpdates } from "@/modules/survey/lib/trigger-updates";
import {
  isSurveySchedulingDue,
  normalizeSurveyScheduling,
  reconcileDueSurveySchedules,
} from "@/modules/survey/scheduling/lib/survey-scheduling";
import { v3DistributionToScalars } from "./distribution";
import { type TV3SurveyLanguageRequest, ensureV3WorkspaceLanguages } from "./languages";
import { prepareV3SurveyPatchInput } from "./prepare";
import { V3SurveyReferenceValidationError } from "./reference-validation";
import type { TV3SurveyDocument } from "./schemas";
import {
  areV3SurveyTargetingFiltersEqual,
  assertV3SurveyTargetingFilterReferences,
  setV3SurveySegmentFilters,
} from "./targeting";
import { resolveV3SurveyTriggers } from "./triggers";
import { getV3SurveyMediaInvalidParams } from "./validation";
import { assertV3SurveyTargetingWritePermission, assertV3SurveyWritePermissions } from "./write-permissions";

function buildSurveyLanguageUpdate(
  currentSurvey: TSurvey,
  languages: TSurvey["languages"]
): Prisma.SurveyUpdateInput["languages"] {
  const currentLanguageIds = currentSurvey.languages.map((surveyLanguage) => surveyLanguage.language.id);
  const updatedLanguageIds = languages.map((surveyLanguage) => surveyLanguage.language.id);
  const enabledLanguageIds = new Set(
    languages
      .filter((surveyLanguage) => surveyLanguage.enabled)
      .map((surveyLanguage) => surveyLanguage.language.id)
  );
  const defaultLanguageId = languages.find((surveyLanguage) => surveyLanguage.default)?.language.id;

  const languagesToAdd = updatedLanguageIds.filter((languageId) => !currentLanguageIds.includes(languageId));
  const languagesToRemove = currentLanguageIds.filter(
    (languageId) => !updatedLanguageIds.includes(languageId)
  );

  return {
    updateMany: currentLanguageIds.map((languageId) => ({
      where: {
        languageId,
      },
      data: {
        default: languageId === defaultLanguageId,
        enabled: enabledLanguageIds.has(languageId),
      },
    })),
    ...(languagesToAdd.length > 0
      ? {
          create: languagesToAdd.map((languageId) => ({
            languageId,
            default: languageId === defaultLanguageId,
            enabled: enabledLanguageIds.has(languageId),
          })),
        }
      : {}),
    ...(languagesToRemove.length > 0
      ? {
          deleteMany: languagesToRemove.map((languageId) => ({
            languageId,
          })),
        }
      : {}),
  };
}

async function reconcilePersistedV3SurveyPatch({
  survey,
  workspaceId,
}: {
  survey: TSurvey;
  workspaceId: string;
}): Promise<TSurvey> {
  if (!isSurveySchedulingDue(survey)) {
    return survey;
  }

  const reconciliationResult = await reconcileDueSurveySchedules({
    logContext: {
      source: "v3-survey-patch",
      surveyId: survey.id,
      workspaceId,
    },
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
}

type TV3SegmentFilterWrite = {
  segmentId: string;
  filters: NonNullable<TV3SurveyDocument["targeting"]>["filters"];
};

/**
 * Apply the app-only distribution onto the survey update `data` (display scalars + the triggers diff)
 * and return the segment-filter write to perform, if targeting actually changed. Trigger ids are
 * validated first so an invalid id fails before any write. The segment write is RETURNED rather than
 * executed so the caller can run it in the same transaction as the survey update. Entitlement for
 * changed targeting is gated upstream in `patchV3Survey`.
 */
async function buildV3AppSurveyPatchWrites(params: {
  currentSurvey: TSurvey;
  document: TV3SurveyDocument;
  data: Prisma.SurveyUpdateInput;
}): Promise<TV3SegmentFilterWrite | null> {
  const { currentSurvey, document, data } = params;
  const distribution = document.distribution;
  if (!distribution) {
    return null;
  }

  const actionClasses = await getActionClasses(currentSurvey.workspaceId);
  const resolvedTriggers = resolveV3SurveyTriggers(distribution.triggers, actionClasses);

  Object.assign(data, v3DistributionToScalars(distribution));
  data.triggers = handleTriggerUpdates(resolvedTriggers, currentSurvey.triggers, actionClasses);

  const nextFilters = document.targeting?.filters ?? [];
  const segmentId = currentSurvey.segment?.id;
  const filtersChanged = !areV3SurveyTargetingFiltersEqual(currentSurvey.segment?.filters ?? [], nextFilters);

  if (!filtersChanged) {
    return null;
  }
  // App surveys auto-create a private segment; if one is somehow missing we cannot persist the
  // targeting change. Fail loudly instead of returning 200 while silently dropping the filters.
  if (!segmentId) {
    throw new V3SurveyReferenceValidationError([
      {
        name: "targeting.filters",
        reason: "Cannot apply contact targeting: this app survey has no segment to store filters on.",
      },
    ]);
  }

  // Validate attribute-key references on the changed filters before the write (mirrors trigger ids).
  await assertV3SurveyTargetingFilterReferences(currentSurvey.workspaceId, nextFilters);

  return { segmentId, filters: nextFilters };
}

export async function executeV3SurveyPatch(params: {
  currentSurvey: TSurvey;
  document: TV3SurveyDocument;
  languageRequests: TV3SurveyLanguageRequest[];
  requestId?: string;
}): Promise<TSurvey> {
  const { currentSurvey, document, languageRequests, requestId } = params;
  const mediaInvalidParams = getV3SurveyMediaInvalidParams(document.blocks);
  if (mediaInvalidParams.length > 0) {
    throw new V3SurveyReferenceValidationError(mediaInvalidParams);
  }

  // An app survey can never be shown without a trigger, so reject setting a non-draft status with no
  // effective triggers. Triggers only change when the patch carries a `distribution` (top-level
  // replacement); otherwise the survey keeps its current triggers.
  const effectiveTriggers = document.distribution ? document.distribution.triggers : currentSurvey.triggers;
  if (isAppSurveyMissingTriggersToPublish(currentSurvey.type, document.status, effectiveTriggers)) {
    throw new V3SurveyReferenceValidationError([
      { name: "triggers", reason: APP_SURVEY_TRIGGER_REQUIRED_MESSAGE },
    ]);
  }

  const languages = await ensureV3WorkspaceLanguages(currentSurvey.workspaceId, languageRequests, requestId);
  const normalizedScheduling = normalizeSurveyScheduling({
    currentStatus: currentSurvey.status,
    closeOn: currentSurvey.closeOn,
    publishOn: currentSurvey.publishOn,
    status: document.status,
  });

  const data: Prisma.SurveyUpdateInput = {
    name: document.name,
    status: document.status,
    metadata: document.metadata,
    welcomeCard: document.welcomeCard,
    blocks: stripIsDraftFromBlocks(document.blocks),
    endings: document.endings,
    hiddenFields: document.hiddenFields,
    variables: document.variables,
    closeOn: normalizedScheduling.closeOn,
    publishOn: normalizedScheduling.publishOn,
    languages: buildSurveyLanguageUpdate(currentSurvey, languages),
  };

  // App-only runtime/distribution settings (display scalars, triggers); also yields the segment
  // targeting write to perform, if any.
  const segmentFilterWrite =
    currentSurvey.type === "app"
      ? await buildV3AppSurveyPatchWrites({ currentSurvey, document, data })
      : null;

  const runSurveyUpdate = (client: Prisma.TransactionClient = prisma) =>
    client.survey.update({ where: { id: currentSurvey.id }, data, select: selectSurvey });

  try {
    // One transaction, always. Two writes have to land with the survey or not at all:
    //
    // - Segment filters live on a separate row, so a mid-write failure would leave targeting out of
    //   step with the survey it belongs to.
    // - ENG-1837 made the EmbeddedData tables the read source of truth for definitions, so a patch
    //   that moves `variables` / `hiddenFields` without reconciling the rows leaves recall, the logic
    //   engine, export columns and the response filters reading the pre-patch set. This used to be a
    //   dormant inconsistency (readers used the legacy columns this write does update); it stops
    //   being dormant the moment the readers point at the rows.
    //
    // The reconcile therefore runs here rather than after the commit — matching `updateSurveyInternal`
    // — which is what makes the unconditional transaction necessary: a same-statement fast path can
    // no longer be correct.
    const persistedSurvey = await prisma.$transaction(
      async (tx) => {
        if (segmentFilterWrite) {
          await setV3SurveySegmentFilters(segmentFilterWrite.segmentId, segmentFilterWrite.filters, tx);
        }

        const survey = await runSurveyUpdate(tx);

        // Derived from the PERSISTED survey, not the patch document: a patch may omit `variables` or
        // `hiddenFields` entirely, and reading the payload would see them as absent and delete every
        // row. `workspaceId` comes from the stored survey, never the client (ENG-1749).
        await reconcileEmbeddedData(tx, {
          surveyId: currentSurvey.id,
          workspaceId: currentSurvey.workspaceId,
          desired: toDesiredEmbeddedFields(survey),
        });

        return survey;
      },
      // Matched to the other reconcile call sites: this transaction rewrites blocks and languages,
      // reads back through `selectSurvey`'s deep select, and now adds an indexed read plus a write
      // per changed field — enough to approach Prisma's 5s default on a large survey.
      { timeout: 20_000, maxWait: 10_000 }
    );

    return await reconcilePersistedV3SurveyPatch({
      survey: transformPrismaSurvey<TSurvey>(persistedSurvey),
      workspaceId: currentSurvey.workspaceId,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
}

export async function patchV3Survey(
  currentSurvey: TSurvey,
  input: unknown,
  requestId?: string,
  organizationId?: string
): Promise<TSurvey> {
  const preparation = prepareV3SurveyPatchInput(currentSurvey, input);
  if (!preparation.ok) {
    throw new V3SurveyReferenceValidationError(preparation.validation.invalidParams);
  }

  await assertV3SurveyWritePermissions(
    {
      workspaceId: currentSurvey.workspaceId,
      blocks: preparation.document.blocks,
      endings: preparation.document.endings,
      previous: {
        blocks: currentSurvey.blocks,
        endings: currentSurvey.endings,
      },
    },
    organizationId
  );

  await assertV3SurveyTargetingWritePermission(currentSurvey, preparation.document, organizationId);

  return await executeV3SurveyPatch({
    currentSurvey,
    document: preparation.document,
    languageRequests: preparation.languageRequests,
    requestId,
  });
}
