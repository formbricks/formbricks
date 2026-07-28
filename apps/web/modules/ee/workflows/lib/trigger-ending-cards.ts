import type { TWorkflowDefinition } from "@formbricks/workflows";

export interface TEndingCardReconciliation {
  /** Stored ids that still resolve to an ending on the survey, de-duplicated, order preserved. */
  endingCardIds: string[];
  /**
   * Stored ids that no longer resolve to an ending on the survey. Duplicates are dropped from
   * `endingCardIds` too but are deliberately NOT listed here — they are not missing endings, and
   * counting them would inflate the "N endings were removed" message.
   */
  removedEndingCardIds: string[];
}

/**
 * Reconciles a trigger's stored `endingCardIds` against the endings the survey actually has.
 *
 * Stored ids drift: deleting an ending card in the survey editor leaves its id behind on every
 * workflow trigger that referenced it. The server's enable pre-flight rejects those ids
 * (`verifyTriggerSurvey` -> `missingEndingCardIds`), so a workflow carrying one cannot be enabled
 * until the id is dropped.
 *
 * Pure on purpose — callers pass in the survey's current ending ids; nothing here fetches.
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
 * selection is already clean so callers can use it as their "nothing to write" signal and avoid
 * marking the editor dirty on every render.
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
  // Reconciling only ever drops entries (never adds or reorders), so a matching length means the
  // stored list already equals the reconciled one.
  if (endingCardIds.length === trigger.config.endingCardIds.length) return null;

  return {
    definition: {
      ...definition,
      trigger: { ...trigger, config: { ...trigger.config, endingCardIds } },
    },
    removedEndingCardIds,
  };
};
