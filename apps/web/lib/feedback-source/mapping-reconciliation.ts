import "server-only";
import { after } from "next/server";
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
import { type TSurveyElementIndex, indexSurveyElements } from "./survey-elements";

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

type TMappingElementId = Pick<TFeedbackSourceFormbricksMapping, "surveyId" | "elementId" | "hubFieldType">;

type TMappingHubFieldType = { elementId: string; hubFieldType: THubFieldType };

/**
 * The stored rows for one survey, split by what has to happen to them.
 *
 * `removed` and `unmappable` are kept apart because only one of them is safe to defer.
 *
 * The element is GONE (`removed`): the publish path looks its answer up by element id, finds nothing
 * and skips the row (transform.ts), so the row is inert. Keeping it publishes nothing.
 *
 * The element still EXISTS but was retyped to something with no Hub field (`unmappable`) —
 * contactInfo, address, cal, cta, fileUpload, consent. The id is preserved across a retype, so the
 * publish path still finds the answer and ships it under the row's stale hubFieldType: a contactInfo
 * answer is an array, which lands in Hub as `value_text: value.join(", ")` — name, email and phone in
 * one string, for the element types the product refuses to map precisely because they hold that data.
 * These rows are actively leaking.
 */
type TClassifiedMappings = {
  removed: string[];
  unmappable: string[];
  retyped: TMappingHubFieldType[];
};

const classifyStoredMappings = (
  surveyMappings: TMappingElementId[],
  { elementIds, supportedHubFieldTypes }: TSurveyElementIndex
): TClassifiedMappings => {
  const removed: string[] = [];
  const unmappable: string[] = [];
  const retyped: TMappingHubFieldType[] = [];

  for (const mapping of surveyMappings) {
    const currentHubFieldType = supportedHubFieldTypes.get(mapping.elementId);

    if (!currentHubFieldType) {
      (elementIds.has(mapping.elementId) ? unmappable : removed).push(mapping.elementId);
    } else if (currentHubFieldType !== mapping.hubFieldType) {
      retyped.push({ elementId: mapping.elementId, hubFieldType: currentHubFieldType });
    }
  }

  return { removed, unmappable, retyped };
};

/** Supported elements of this survey that no stored row covers yet. */
const collectUnmappedElements = (
  surveyMappings: TMappingElementId[],
  supportedHubFieldTypes: TSurveyElementIndex["supportedHubFieldTypes"]
): TMappingHubFieldType[] => {
  const mappedElementIds = new Set(surveyMappings.map((mapping) => mapping.elementId));

  return [...supportedHubFieldTypes]
    .filter(([elementId]) => !mappedElementIds.has(elementId))
    .map(([elementId, hubFieldType]) => ({ elementId, hubFieldType }));
};

/**
 * Which of the classified rows actually get deleted.
 *
 * A source with zero rows for a survey is unrecoverable: every other write path requires min(1), and
 * getFeedbackSourcesToReconcile matches on `formbricksMappings: { some: { surveyId } }`, so the source
 * would never be found for this survey again. Where the only rows left are inert, keeping them costs
 * nothing and preserves that handle — a pending create rescues the source too, so the hold only
 * applies when nothing is being added.
 *
 * Leaking rows are never held back: stopping the export outranks keeping the source discoverable.
 */
const resolveDeletions = (
  { removed, unmappable }: TClassifiedMappings,
  context: { surveyId: string; surveyMappingCount: number; hasPendingCreates: boolean }
): string[] => {
  const { surveyId, surveyMappingCount, hasPendingCreates } = context;

  const wouldRemoveEveryMapping =
    !hasPendingCreates && surveyMappingCount > 0 && removed.length + unmappable.length === surveyMappingCount;

  if (!wouldRemoveEveryMapping) {
    return [...removed, ...unmappable];
  }

  if (removed.length > 0) {
    // debug, not warn: this state is permanent for as long as the source is left alone, and it is
    // re-evaluated on every survey write — including saves that change nothing about the questions. At
    // warn it reported the same standing condition forever and drowned out the one-off errors below.
    // Nothing is lost: when the whole delta is empty the caller does no DB work either.
    logger.debug(
      { surveyId, mappingCount: surveyMappingCount, unmappableCount: unmappable.length },
      "Keeping inert feedback-source mappings: deleting them would leave this survey with none"
    );
    return unmappable;
  }

  // Only leaking rows are left, so they all go and the source loses its handle on this survey. That is
  // the lesser harm, but it needs a human, so say so loudly.
  logger.error(
    { surveyId, mappingCount: surveyMappingCount },
    "Removing every feedback-source mapping for this survey: all mapped questions were retyped to types with no Hub field. The source must be re-mapped."
  );
  return unmappable;
};

/**
 * Diff one survey's stored formbricksMappings against that survey's current blocks and produce a
 * minimal reconciliation delta.
 *
 * - Elements retyped to a type with no Hub field → `toDelete`, always (the creation path in
 *   `resolveFormbricksMappingsInput` refuses to map these, so keeping the row would let an element
 *   the product explicitly excludes keep publishing under a stale hubFieldType)
 * - Elements removed from the survey → `toDelete`, unless that would leave the survey with no rows
 *   at all; see `resolveDeletions`
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
  storedMappings: TMappingElementId[],
  blocks: TSurveyBlock[],
  surveyId: string,
  elementScope: TFeedbackSourceElementScope
): TFeedbackSourceReconciliation => {
  const surveyMappings = storedMappings.filter((mapping) => mapping.surveyId === surveyId);
  const elementIndex = indexSurveyElements(blocks);

  const classified = classifyStoredMappings(surveyMappings, elementIndex);
  const toCreate =
    elementScope === "all"
      ? collectUnmappedElements(surveyMappings, elementIndex.supportedHubFieldTypes)
      : [];

  return {
    toCreate,
    toDelete: resolveDeletions(classified, {
      surveyId,
      surveyMappingCount: surveyMappings.length,
      hasPendingCreates: toCreate.length > 0,
    }),
    toUpdate: classified.retyped,
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
      // The flag below is set by a previous run, not necessarily this one, so the repair has to clear
      // it from here too. Retype the survey's only question to File Upload and the source is flagged;
      // retype it back and an `all`-scoped reconcile re-creates the row, so the source is correct again
      // while still wearing an `error` badge and still filtered out of the publish path. Saving the
      // source in the edit modal clears it, but nothing about this repair requires opening that modal.
      //
      // Scoped to `error` for the same reason as the flag: a deliberately `paused` source stays paused.
      if (toCreate.length > 0) {
        await tx.feedbackSource.updateMany({
          where: { id: feedbackSourceId, workspaceId, status: "error" },
          data: { status: "active" },
        });
      }

      if (toDelete.length > 0) {
        const remainingMappings = await tx.feedbackSourceFormbricksMapping.count({
          where: { feedbackSourceId, workspaceId },
        });

        if (remainingMappings === 0) {
          // updateMany scoped to `active`: this write was unconditional, so it also overwrote
          // `paused`. The resume toggle would then flip that source to `active` and silently resume
          // something an operator had deliberately disabled. A paused source with no mappings is
          // still paused — it is not publishing either way, and `error` is a claim about the source
          // being broken rather than about it being off.
          const flagged = await tx.feedbackSource.updateMany({
            where: { id: feedbackSourceId, workspaceId, status: "active" },
            data: { status: "error" },
          });

          if (flagged.count === 0) {
            return;
          }
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

    // Concurrent, not sequential: each source reconciles a distinct `feedbackSourceId` in its own
    // transaction with no data dependency on the others, and both callers await this before
    // responding — so a survey mapped by several sources paid N round trips in series on every save
    // instead of being bounded by the slowest one. `applyReconciliationToFeedbackSource` swallows its
    // own errors, so `allSettled` is belt-and-braces rather than load-bearing.
    const pending = feedbackSources
      .map((source) => ({
        source,
        reconciliation: reconcileMappingsAgainstSurvey(
          source.formbricksMappings,
          blocks,
          surveyId,
          source.elementScope
        ),
      }))
      .filter(({ reconciliation }) => !isEmptyReconciliation(reconciliation));

    await Promise.allSettled(
      pending.map(({ source, reconciliation }) =>
        applyReconciliationToFeedbackSource(source.id, source.workspaceId, surveyId, reconciliation)
      )
    );
  } catch (error) {
    logger.error({ surveyId, error }, "Failed to reconcile feedback sources after survey update");
  }
};

/**
 * The survey's blocks as they are stored *right now*.
 *
 * Deliberately a fresh read rather than anything cached: its whole purpose is to observe writes that
 * landed after the caller captured its own snapshot.
 */
const readPersistedSurveyBlocks = async (
  surveyId: string,
  workspaceId: string
): Promise<TSurveyBlock[] | null> => {
  const survey = await prisma.survey.findUnique({
    // Scoped by the composite @@unique([id, workspaceId]) rather than the id alone. The id here is the
    // survey the caller just persisted and was authorized on, so this is defense in depth rather than
    // a hole being closed — but it keeps the tenant constraint next to the read instead of resting on
    // FKs in another file, and it is what the repo asks of every query.
    where: { id: surveyId, workspaceId },
    select: { blocks: true },
  });

  return survey ? (survey.blocks as unknown as TSurveyBlock[]) : null;
};

/**
 * Reconcile after the response has been sent, against the survey's *current* persisted blocks.
 *
 * Both callers persist the survey and then reconcile, so every save — including the editor's
 * 10-second draft autosave — used to pay for a `findMany` (and a transaction on a real delta) on the
 * request path, for work whose result the response does not contain. It is best-effort and swallows
 * its own errors, so nothing downstream depends on it having finished.
 *
 * Deferred with `after()` rather than simply dropped: an un-awaited promise in a serverless runtime
 * can be killed when the response is sent, which would turn "slower saves" into "mappings that
 * silently stop reconciling".
 *
 * **Re-reads the blocks inside the deferred task**, and does not reconcile against the snapshot the
 * caller captured. `after()` callbacks from concurrent requests are not serialized, so a callback
 * from an older save can run after a newer one; applying its snapshot would delete mappings the
 * newer save created, or recreate mappings it removed. At a 10-second autosave interval that
 * interleaving is routine rather than exotic. Re-reading makes a late callback converge instead:
 * whichever runs last reconciles against what is actually stored, so the end state is the same
 * either way.
 *
 * Outside a request — scripts, jobs, tests — `after()` throws. There the caller's blocks are the
 * freshest thing available and there is no interleaving to lose to, so that path awaits inline with
 * the snapshot it was given.
 */
export const scheduleFeedbackSourceReconciliation = async (
  surveyId: string,
  workspaceId: string,
  blocks: TSurveyBlock[]
): Promise<void> => {
  try {
    after(async () => {
      try {
        const persisted = await readPersistedSurveyBlocks(surveyId, workspaceId);
        // Null means the survey is gone — deleted between the save and this callback — or that the id
        // and workspace no longer agree. Either way, skip: diffing against nothing would read as "this
        // survey has no questions" and delete every mapping for it.
        if (!persisted) return;

        await reconcileFeedbackSourcesForSurvey(surveyId, persisted);
      } catch (error) {
        // Next swallows throws from an `after()` callback, so the read is guarded here rather than
        // left to disappear silently.
        logger.error({ surveyId, error }, "Failed to reconcile feedback sources after the response");
      }
    });
  } catch {
    await reconcileFeedbackSourcesForSurvey(surveyId, blocks);
  }
};
