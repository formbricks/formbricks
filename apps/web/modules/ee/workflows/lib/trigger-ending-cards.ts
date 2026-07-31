import type { TWorkflowDefinition } from "@formbricks/workflows";

export interface TEndingCardReconciliation {
  /** Stored ids that still resolve to a survey ending, de-duplicated, order preserved. */
  endingCardIds: string[];
  /** Stored ids that no longer resolve to a survey ending. Excludes dropped duplicates — they
   * aren't missing endings and would inflate the "N endings removed" message. */
  removedEndingCardIds: string[];
}

/**
 * Reconciles a trigger's stored `endingCardIds` against the survey's current ending ids. Deleting
 * an ending in the survey editor leaves its id on referencing triggers, which the enable pre-flight
 * then rejects. Pure — callers pass the survey's ending ids; nothing here fetches.
 */
export const reconcileEndingCardIds = (
  storedEndingCardIds: readonly string[],
  surveyEndingIds: readonly string[]
): TEndingCardReconciliation => {
  const surveyEndingIdSet = new Set(surveyEndingIds);
  const endingCardIds: string[] = [];
  const removedEndingCardIds: string[] = [];
  const seenEndingCardIds = new Set<string>();

  for (const endingCardId of storedEndingCardIds) {
    if (seenEndingCardIds.has(endingCardId)) continue;
    seenEndingCardIds.add(endingCardId);

    if (surveyEndingIdSet.has(endingCardId)) {
      endingCardIds.push(endingCardId);
    } else {
      removedEndingCardIds.push(endingCardId);
    }
  }

  return { endingCardIds, removedEndingCardIds };
};

/**
 * Definition-level wrapper around {@link reconcileEndingCardIds}. Returns `null` when the stored
 * selection is already clean, so callers can skip writing and not dirty the editor every render.
 */
export const reconcileDefinitionEndingCardIds = (
  definition: TWorkflowDefinition | null,
  surveyEndingIds: readonly string[]
): { definition: TWorkflowDefinition; removedEndingCardIds: string[] } | null => {
  const trigger = definition?.trigger;
  if (!definition || !trigger) return null;

  const { endingCardIds, removedEndingCardIds } = reconcileEndingCardIds(
    trigger.config.endingCardIds,
    surveyEndingIds
  );
  // Reconciling only drops entries (never adds/reorders), so equal length means already clean.
  if (endingCardIds.length === trigger.config.endingCardIds.length) return null;

  return {
    definition: {
      ...definition,
      trigger: { ...trigger, config: { ...trigger.config, endingCardIds } },
    },
    removedEndingCardIds,
  };
};
