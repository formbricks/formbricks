"use client";

import { useSetAtom } from "jotai";
import { useEffect } from "react";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import { reconcileDefinitionEndingCardIds } from "@/modules/ee/workflows/lib/trigger-ending-cards";
import { useWorkflowSurveyEndings } from "@/modules/ee/workflows/list/hooks/use-trigger-survey-picker";
import {
  prunedTriggerEndingCardIdsAtom,
  setWorkflowDefinitionAtom,
} from "@/modules/ee/workflows/state/editor";

interface UseReconcileTriggerEndingCardsProps {
  definition: TWorkflowDefinition | null;
  /** Definition edits are allowed (draft/disabled status, writable member). */
  isEditable: boolean;
}

/**
 * Drops trigger `endingCardIds` that no longer exist on the bound survey.
 *
 * Deleting an ending card in the survey editor leaves its id behind on every workflow trigger
 * that referenced it, and the server's enable pre-flight then refuses the workflow. Reconciling
 * here — at the editor, against the survey's live endings — keeps the stored selection honest, so
 * the canvas summary counts only real endings and enable is never blocked by a phantom id. The
 * page's autosave persists the repair, which is also what stops the drift from coming back.
 *
 * Pruning the LAST id leaves an empty list, which the trigger reads as "all endings" — a widening
 * of what fires the workflow. So the dropped ids are also published to
 * `prunedTriggerEndingCardIdsAtom`, which is how the trigger form knows to keep presenting the
 * "specific endings" scope and ask for a fresh pick rather than let the widening pass unseen.
 *
 * Read-only / enabled / archived workflows are left alone — their definition cannot be PATCHed.
 */
export const useReconcileTriggerEndingCards = ({
  definition,
  isEditable,
}: Readonly<UseReconcileTriggerEndingCardsProps>): void => {
  const setDefinition = useSetAtom(setWorkflowDefinitionAtom);
  const setPrunedEndingCardIds = useSetAtom(prunedTriggerEndingCardIdsAtom);

  const trigger = definition?.trigger ?? null;
  const surveyId = trigger?.config.surveyId ?? null;
  const hasEndingCardIds = (trigger?.config.endingCardIds.length ?? 0) > 0;

  // "All endings" (empty list) has nothing to reconcile, so don't fetch for it. When there is a
  // selection the trigger form's own query shares this cache entry, so an open inspector costs
  // no extra request.
  const endingsQuery = useWorkflowSurveyEndings(hasEndingCardIds ? surveyId : null);
  const { isSuccess, resolvedSurveyId, endings } = endingsQuery;

  useEffect(() => {
    if (!isEditable) return;
    // Only act on a settled response for THIS survey. A pending or failed query (deleted survey,
    // offline, 500) must never read as "the survey has no endings" and wipe a valid selection.
    if (!isSuccess || resolvedSurveyId === null || resolvedSurveyId !== surveyId) return;

    const reconciled = reconcileDefinitionEndingCardIds(
      definition,
      endings.map((ending) => ending.id)
    );
    if (!reconciled) return;

    setDefinition(reconciled.definition);
    // Empty for a de-duplication-only fix, which needs no prompting — the selection still means
    // what the user picked.
    if (reconciled.removedEndingCardIds.length > 0) {
      setPrunedEndingCardIds(reconciled.removedEndingCardIds);
    }
  }, [
    definition,
    endings,
    isEditable,
    isSuccess,
    resolvedSurveyId,
    surveyId,
    setDefinition,
    setPrunedEndingCardIds,
  ]);
};
