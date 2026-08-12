import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import {
  TFeedbackSourceElementScope,
  TFeedbackSourceFormbricksMapping,
  THubFieldType,
} from "@formbricks/types/feedback-source";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { validateInputs } from "../utils/validate";
import { getFeedbackSourcesToReconcile } from "./service";
import { indexSurveyElements } from "./survey-elements";

/**
 * Result of reconciling one survey's stored feedback-source mappings against that survey's current
 * blocks. The caller applies these deltas to keep the mapping rows in sync.
 *
 * Every entry refers to a single (feedbackSource, survey) pair — a source may map several surveys,
 * so the delta is only ever meaningful together with the surveyId it was computed for.
 */
export type TFeedbackSourceReconciliation = {
  /** Supported elements with no mapping row yet. Only ever populated for `all`-scoped sources. */
  toCreate: { elementId: string; hubFieldType: THubFieldType }[];
  /** Mapped elements that no longer exist, or whose new type has no Hub field. */
  toDelete: string[];
  /** Mapped elements that still exist but whose hubFieldType has changed. */
  toUpdate: { elementId: string; hubFieldType: THubFieldType }[];
};

export const isEmptyReconciliation = (reconciliation: TFeedbackSourceReconciliation): boolean =>
  reconciliation.toCreate.length === 0 &&
  reconciliation.toDelete.length === 0 &&
  reconciliation.toUpdate.length === 0;

/**
 * Diff one survey's stored formbricksMappings against that survey's current blocks and produce a
 * minimal reconciliation delta.
 *
 * - Elements removed from the survey → `toDelete`
 * - Elements retyped to a type with no Hub field → `toDelete` (the creation path in
 *   `resolveFormbricksMappingsInput` refuses to map these, so keeping the row would let an element
 *   the product explicitly excludes keep publishing under a stale hubFieldType)
 * - Elements whose Hub field type changed → `toUpdate`
 * - Supported elements with no mapping row → `toCreate`, but **only** when `elementScope` is `all`
 * - Unchanged elements → left alone
 *
 * The `elementScope` gate is what makes tracking new questions safe. A question added after the source
 * was connected is indistinguishable here from one the operator deliberately excluded — survey elements
 * carry no timestamps — so the answer is recorded at selection time instead and simply read back.
 * `specific` sources therefore never gain mappings on their own.
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
  surveyId: string,
  elementScope: TFeedbackSourceElementScope
): TFeedbackSourceReconciliation => {
  const surveyMappings = storedMappings.filter((mapping) => mapping.surveyId === surveyId);
  const { elementIds, supportedHubFieldTypes } = indexSurveyElements(blocks);

  const toCreate: { elementId: string; hubFieldType: THubFieldType }[] = [];
  const toUpdate: { elementId: string; hubFieldType: THubFieldType }[] = [];

  // Two different reasons a row must go, kept apart because only one of them is safe to defer.
  //
  // The element is GONE: the publish path looks its answer up by element id, finds nothing and skips
  // the row (transform.ts), so the row is inert. Keeping it publishes nothing.
  //
  // The element still EXISTS but was retyped to something with no Hub field — contactInfo, address,
  // cal, cta, fileUpload, consent. The id is preserved across a retype, so the publish path still
  // finds the answer and ships it under the row's stale hubFieldType: a contactInfo answer is an
  // array, which lands in Hub as `value_text: value.join(", ")` — name, email and phone in one
  // string, for the element types the product refuses to map precisely because they hold that data.
  // These rows are actively leaking and must always be deleted.
  const removedElementIds: string[] = [];
  const unmappableElementIds: string[] = [];

  for (const mapping of surveyMappings) {
    const currentHubFieldType = supportedHubFieldTypes.get(mapping.elementId);

    if (!currentHubFieldType) {
      if (elementIds.has(mapping.elementId)) {
        unmappableElementIds.push(mapping.elementId);
      } else {
        removedElementIds.push(mapping.elementId);
      }
      continue;
    }

    if (currentHubFieldType !== mapping.hubFieldType) {
      toUpdate.push({ elementId: mapping.elementId, hubFieldType: currentHubFieldType });
    }
  }

  if (elementScope === "all") {
    const mappedElementIds = new Set(surveyMappings.map((mapping) => mapping.elementId));
    for (const [elementId, hubFieldType] of supportedHubFieldTypes) {
      if (mappedElementIds.has(elementId)) continue;
      toCreate.push({ elementId, hubFieldType });
    }
  }

  // A source with zero rows for a survey is unrecoverable: every other write path requires min(1), and
  // getFeedbackSourcesToReconcile matches on `formbricksMappings: { some: { surveyId } }`, so the source
  // would never be found for this survey again. Where the only rows left are inert (their elements are
  // gone), keeping them costs nothing and preserves that handle — a pending create rescues the source
  // too, so the hold only applies when nothing is being added.
  //
  // Leaking rows are never held back: stopping the export outranks keeping the source discoverable.
  const wouldRemoveEveryMapping =
    toCreate.length === 0 &&
    removedElementIds.length + unmappableElementIds.length === surveyMappings.length &&
    surveyMappings.length > 0;
  const holdBackRemovedRows = wouldRemoveEveryMapping && removedElementIds.length > 0;

  if (holdBackRemovedRows) {
    logger.warn(
      { surveyId, mappingCount: surveyMappings.length, unmappableCount: unmappableElementIds.length },
      "Keeping inert feedback-source mappings: deleting them would leave this survey with none"
    );
  } else if (wouldRemoveEveryMapping) {
    // Only leaking rows are left, so they all go and the source loses its handle on this survey. That
    // is the lesser harm, but it needs a human, so say so loudly.
    logger.error(
      { surveyId, mappingCount: surveyMappings.length },
      "Removing every feedback-source mapping for this survey: all mapped questions were retyped to types with no Hub field. The source must be re-mapped."
    );
  }

  return {
    toCreate,
    toDelete: holdBackRemovedRows ? unmappableElementIds : [...removedElementIds, ...unmappableElementIds],
    toUpdate,
  };
};

/**
 * Apply a reconciliation delta to one survey's mappings on a feedback source.
 *
 * Every write is scoped by (feedbackSourceId, workspaceId, surveyId) so a source that maps several
 * surveys only ever has the reconciled survey's rows touched.
 *
 * Runs inside a single Prisma transaction so the delete + update + create batch is atomic.
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
          // Two concurrent saves of the same survey can both see an element as unmapped; the unique
          // key (workspaceId, feedbackSourceId, surveyId, elementId) makes the loser a no-op rather
          // than a failed transaction.
          skipDuplicates: true,
        });
      }

      // A source stripped of its last mapping has nothing left to publish, and reconciliation can
      // never find it again (its lookup matches on `formbricksMappings: { some: { surveyId } }`), so
      // it would sit in the sources table looking healthy while silently doing nothing. Flag it: the
      // `error` badge already renders, and the status also takes it out of the publish path until
      // someone re-maps it.
      //
      // Counted after the creates, and across every survey the source maps rather than just this one —
      // a source still serving a sibling survey is working, and erroring it would stop that too.
      if (toDelete.length > 0) {
        const remainingMappings = await tx.feedbackSourceFormbricksMapping.count({
          where: { feedbackSourceId, workspaceId },
        });

        if (remainingMappings === 0) {
          await tx.feedbackSource.update({
            where: { id: feedbackSourceId, workspaceId },
            data: { status: "error" },
          });
          logger.error(
            { feedbackSourceId, workspaceId, surveyId },
            "Flagged feedback source as errored: reconciliation removed its last mapping, so it has nothing left to publish"
          );
        }
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
    const feedbackSources = await getFeedbackSourcesToReconcile(surveyId);
    for (const source of feedbackSources) {
      const reconciliation = reconcileMappingsAgainstSurvey(
        source.formbricksMappings,
        blocks,
        surveyId,
        source.elementScope
      );
      if (isEmptyReconciliation(reconciliation)) continue;
      await applyReconciliationToFeedbackSource(source.id, source.workspaceId, surveyId, reconciliation);
    }
  } catch (error) {
    logger.error({ surveyId, error }, "Failed to reconcile feedback sources after survey update");
  }
};
