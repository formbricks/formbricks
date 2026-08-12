import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import {
  TFeedbackSourceFormbricksMapping,
  THubFieldType,
  getHubFieldTypeFromElementType,
} from "@formbricks/types/feedback-source";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { validateInputs } from "../utils/validate";
import { getFeedbackSourcesBySurveyId } from "./service";

/**
 * Result of reconciling one survey's stored feedback-source mappings against that survey's current
 * blocks. The caller applies these deltas to keep the mapping rows in sync.
 *
 * Every entry refers to a single (feedbackSource, survey) pair — a source may map several surveys,
 * so the delta is only ever meaningful together with the surveyId it was computed for.
 */
export type TFeedbackSourceReconciliation = {
  /** Mapped elements that no longer exist, or whose new type has no Hub field. */
  toDelete: string[];
  /** Mapped elements that still exist but whose hubFieldType has changed. */
  toUpdate: { elementId: string; hubFieldType: THubFieldType }[];
};

/** Fresh object per call: the arrays are handed to callers, so a shared constant could be aliased. */
const emptyReconciliation = (): TFeedbackSourceReconciliation => ({ toDelete: [], toUpdate: [] });

export const isEmptyReconciliation = (reconciliation: TFeedbackSourceReconciliation): boolean =>
  reconciliation.toDelete.length === 0 && reconciliation.toUpdate.length === 0;

/**
 * Diff one survey's stored formbricksMappings against that survey's current blocks and produce a
 * minimal reconciliation delta.
 *
 * - Elements removed from the survey → `toDelete`
 * - Elements retyped to a type with no Hub field → `toDelete` (the creation path in
 *   `resolveFormbricksMappingsInput` refuses to map these, so keeping the row would let an element
 *   the product explicitly excludes keep publishing under a stale hubFieldType)
 * - Elements whose Hub field type changed → `toUpdate`
 * - Unchanged elements → left alone
 *
 * `storedMappings` may contain rows for other surveys of the same source, so they are filtered by
 * `surveyId` first — mirroring the publish path in `transform.ts`. Without that filter every mapping
 * belonging to a sibling survey looks like a removed element.
 *
 * This is a **pure** function that works from the caller-supplied survey blocks so it can run inside
 * or outside a transaction; it does not read the database.
 */
export const reconcileMappingsAgainstSurvey = (
  storedMappings: Pick<TFeedbackSourceFormbricksMapping, "surveyId" | "elementId" | "hubFieldType">[],
  blocks: TSurveyBlock[],
  surveyId: string
): TFeedbackSourceReconciliation => {
  const surveyMappings = storedMappings.filter((mapping) => mapping.surveyId === surveyId);

  // Every element the product can represent as a Hub field, resolved once and reused below.
  //
  // `getHubFieldTypeFromElementType` is declared as returning THubFieldType but is really a bare
  // index access, so it yields undefined for the UNSUPPORTED_FEEDBACK_SOURCE_ELEMENT_TYPES
  // (contactInfo, address, cal, cta, fileUpload, consent) — hence the cast and the filter.
  const supportedHubFieldTypes = new Map<string, THubFieldType>();
  for (const element of getElementsFromBlocks(blocks)) {
    const hubFieldType = getHubFieldTypeFromElementType(element.type) as THubFieldType | undefined;
    if (hubFieldType) {
      supportedHubFieldTypes.set(element.id, hubFieldType);
    }
  }

  const toDelete: string[] = [];
  const toUpdate: { elementId: string; hubFieldType: THubFieldType }[] = [];

  for (const mapping of surveyMappings) {
    const currentHubFieldType = supportedHubFieldTypes.get(mapping.elementId);

    // Absent covers both "the question was deleted" and "it was retyped to something with no Hub
    // field". Either way the row can no longer publish anything meaningful, and the creation path in
    // `resolveFormbricksMappingsInput` refuses to map such an element in the first place — so keeping
    // it would let an element the product excludes keep publishing under a stale hubFieldType.
    if (!currentHubFieldType) {
      toDelete.push(mapping.elementId);
      continue;
    }

    if (currentHubFieldType !== mapping.hubFieldType) {
      toUpdate.push({ elementId: mapping.elementId, hubFieldType: currentHubFieldType });
    }
  }

  // Both action schemas require min(1) mapping and resolveFormbricksMappingsInput throws on an empty
  // set, so a formbricks_survey source with zero rows for its survey is a state the rest of the app
  // cannot produce or represent — and it is unrecoverable, because getFeedbackSourcesBySurveyId
  // matches on `formbricksMappings: { some: { surveyId } }`, so the source would never be found for
  // this survey again (no future reconcile, no re-add). Keep the rows and let a human re-map.
  if (toDelete.length === surveyMappings.length && surveyMappings.length > 0) {
    logger.warn(
      { surveyId, mappingCount: surveyMappings.length },
      "Skipping feedback-source reconciliation: it would remove every mapping for this survey"
    );
    return emptyReconciliation();
  }

  return { toDelete, toUpdate };
};

/**
 * Apply a reconciliation delta to one survey's mappings on a feedback source.
 *
 * Every write is scoped by (feedbackSourceId, workspaceId, surveyId) so a source that maps several
 * surveys only ever has the reconciled survey's rows touched.
 *
 * Runs inside a single Prisma transaction so the delete + update batch is atomic.
 */
export const applyReconciliationToFeedbackSource = async (
  feedbackSourceId: string,
  workspaceId: string,
  surveyId: string,
  reconciliation: TFeedbackSourceReconciliation
): Promise<void> => {
  const { toDelete, toUpdate } = reconciliation;
  if (isEmptyReconciliation(reconciliation)) {
    return;
  }

  try {
    // Defense in depth, matching every sibling writer in service.ts. These ids come from our own
    // query rather than a request, so a failure here means a caller wired something wrong — inside
    // the try so it is logged like any other failure and the remaining sources still reconcile.
    validateInputs([feedbackSourceId, ZId], [workspaceId, ZId], [surveyId, ZId]);

    await prisma.$transaction(async (tx) => {
      if (toDelete.length > 0) {
        await tx.feedbackSourceFormbricksMapping.deleteMany({
          where: { feedbackSourceId, workspaceId, surveyId, elementId: { in: toDelete } },
        });
      }

      // One statement per distinct hubFieldType (at most the size of the HubFieldType enum) rather
      // than one per element, so a large retype stays a couple of round-trips.
      const elementIdsByHubFieldType = new Map<THubFieldType, string[]>();
      for (const { elementId, hubFieldType } of toUpdate) {
        const existing = elementIdsByHubFieldType.get(hubFieldType);
        if (existing) {
          existing.push(elementId);
        } else {
          elementIdsByHubFieldType.set(hubFieldType, [elementId]);
        }
      }

      for (const [hubFieldType, elementIds] of elementIdsByHubFieldType) {
        await tx.feedbackSourceFormbricksMapping.updateMany({
          where: { feedbackSourceId, workspaceId, surveyId, elementId: { in: elementIds } },
          data: { hubFieldType },
        });
      }
    });
  } catch (error) {
    logger.error(
      { feedbackSourceId, workspaceId, surveyId, toDelete, toUpdate, error },
      "Failed to apply feedback-source reconciliation"
    );
    // Do not rethrow — reconciliation is best-effort and must not block the survey update.
  }
};

/**
 * Keep every active feedback source that maps `surveyId` in sync with the survey's persisted blocks.
 *
 * Best-effort by design: a reconciliation failure is logged and swallowed so it can never block the
 * survey write that triggered it. Call it *after* the survey has been persisted, and pass the blocks
 * that were actually written — diffing against a request payload would delete mappings for questions
 * that are still in the database.
 */
export const reconcileFeedbackSourcesForSurvey = async (
  surveyId: string,
  blocks: TSurveyBlock[]
): Promise<void> => {
  try {
    const feedbackSources = await getFeedbackSourcesBySurveyId(surveyId);
    for (const source of feedbackSources) {
      const reconciliation = reconcileMappingsAgainstSurvey(source.formbricksMappings, blocks, surveyId);
      if (isEmptyReconciliation(reconciliation)) continue;
      await applyReconciliationToFeedbackSource(source.id, source.workspaceId, surveyId, reconciliation);
    }
  } catch (error) {
    logger.error({ surveyId, error }, "Failed to reconcile feedback sources after survey update");
  }
};
