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
  /** Supported elements added to the survey that have no mapping row yet. */
  toCreate: { elementId: string; hubFieldType: THubFieldType }[];
  /** Mapped elements that no longer exist, or whose new type has no Hub field. */
  toDelete: string[];
  /** Mapped elements that still exist but whose hubFieldType has changed. */
  toUpdate: { elementId: string; hubFieldType: THubFieldType }[];
};

const EMPTY_RECONCILIATION: TFeedbackSourceReconciliation = { toCreate: [], toDelete: [], toUpdate: [] };

export const isEmptyReconciliation = (reconciliation: TFeedbackSourceReconciliation): boolean =>
  reconciliation.toCreate.length === 0 &&
  reconciliation.toDelete.length === 0 &&
  reconciliation.toUpdate.length === 0;

/**
 * Diff one survey's stored formbricksMappings against that survey's current blocks and produce a
 * minimal reconciliation delta.
 *
 * - Supported elements with no mapping row → `toCreate`
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
  const elements = getElementsFromBlocks(blocks);
  const mappedElementIds = new Set(surveyMappings.map((mapping) => mapping.elementId));
  const elementMap = new Map(elements.map((el) => [el.id, el]));

  const toCreate: { elementId: string; hubFieldType: THubFieldType }[] = [];
  const toDelete: string[] = [];
  const toUpdate: { elementId: string; hubFieldType: THubFieldType }[] = [];

  for (const mapping of surveyMappings) {
    const element = elementMap.get(mapping.elementId);
    if (!element) {
      toDelete.push(mapping.elementId);
      continue;
    }

    // Declared as THubFieldType but really a bare index access, so this is undefined for the
    // UNSUPPORTED_FEEDBACK_SOURCE_ELEMENT_TYPES (contactInfo, address, cal, cta, fileUpload, consent).
    const currentHubFieldType = getHubFieldTypeFromElementType(element.type) as THubFieldType | undefined;
    if (!currentHubFieldType) {
      toDelete.push(mapping.elementId);
      continue;
    }

    if (currentHubFieldType !== mapping.hubFieldType) {
      toUpdate.push({ elementId: mapping.elementId, hubFieldType: currentHubFieldType });
    }
  }

  // ENG-2064: a question added after the source was connected would otherwise never be mapped, and
  // the publish path iterates mapping rows — so its answers would be dropped from the dataset for
  // good. Connecting a source pre-selects every supported element, so tracking new ones matches the
  // product default.
  for (const element of elements) {
    if (mappedElementIds.has(element.id)) continue;
    const hubFieldType = getHubFieldTypeFromElementType(element.type) as THubFieldType | undefined;
    if (!hubFieldType) continue;
    toCreate.push({ elementId: element.id, hubFieldType });
  }

  // Both action schemas require min(1) mapping and resolveFormbricksMappingsInput throws on an empty
  // set, so a formbricks_survey source with zero rows for its survey is a state the rest of the app
  // cannot produce or represent — and it is unrecoverable, because getFeedbackSourcesBySurveyId
  // matches on `formbricksMappings: { some: { surveyId } }`, so the source would never be found for
  // this survey again (no future reconcile, no re-add). Keep the rows and let a human re-map.
  if (toCreate.length === 0 && toDelete.length === surveyMappings.length && surveyMappings.length > 0) {
    logger.warn(
      { surveyId, mappingCount: surveyMappings.length },
      "Skipping feedback-source reconciliation: it would remove every mapping for this survey"
    );
    return EMPTY_RECONCILIATION;
  }

  return { toCreate, toDelete, toUpdate };
};

/**
 * Apply a reconciliation delta to one survey's mappings on a feedback source.
 *
 * Every write is scoped by (feedbackSourceId, workspaceId, surveyId) so a source that maps several
 * surveys only ever has the reconciled survey's rows touched.
 *
 * Runs inside a single Prisma transaction so the create + delete + update batch is atomic.
 */
export const applyReconciliationToFeedbackSource = async (
  feedbackSourceId: string,
  workspaceId: string,
  surveyId: string,
  reconciliation: TFeedbackSourceReconciliation
): Promise<void> => {
  const { toCreate, toDelete, toUpdate } = reconciliation;
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

      if (toCreate.length > 0) {
        await tx.feedbackSourceFormbricksMapping.createMany({
          data: toCreate.map(({ elementId, hubFieldType }) => ({
            feedbackSourceId,
            workspaceId,
            surveyId,
            elementId,
            hubFieldType,
          })),
          // Concurrent saves of the same survey can both see the element as unmapped; the unique
          // key (workspaceId, feedbackSourceId, surveyId, elementId) makes the loser a no-op.
          skipDuplicates: true,
        });
      }
    });
  } catch (error) {
    logger.error(
      { feedbackSourceId, workspaceId, surveyId, toCreate, toDelete, toUpdate, error },
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
