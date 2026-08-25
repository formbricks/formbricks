"use client";

import { useSetAtom } from "jotai";
import { useEffect } from "react";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import { useWorkflowSurveyEndings } from "@/modules/ee/workflows/hooks/use-trigger-survey-picker";
import { reconcileDefinitionEndingCardIds } from "@/modules/ee/workflows/lib/trigger-ending-cards";
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
 * Drops trigger `endingCardIds` whose endings no longer exist on the bound survey, keeping the
 * canvas summary honest and the enable gate unblocked by phantom ids; the page's autosave persists
 * the repair. Dropped ids are published to `prunedTriggerEndingCardIdsAtom` because emptying the
 * last id reads as "all endings" (a widening) — the trigger form uses that to keep asking for a
 * fresh pick. Read-only / enabled / archived workflows are skipped (definition can't be PATCHed).
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

  // "All endings" (empty list) has nothing to reconcile — skip the fetch. With a selection, the
  // trigger form's query shares this cache entry, so an open inspector costs no extra request.
  const endingsQuery = useWorkflowSurveyEndings(hasEndingCardIds ? surveyId : null);
  const { isSuccess, resolvedSurveyId, endings } = endingsQuery;

  useEffect(() => {
    if (!isEditable) return;
    // Only act on a settled response for THIS survey — a pending/failed query must never read as
    // "no endings" and wipe a valid selection.
    if (!isSuccess || resolvedSurveyId === null || resolvedSurveyId !== surveyId) return;

    const reconciled = reconcileDefinitionEndingCardIds(
      definition,
      endings.map((ending) => ending.id)
    );
    if (!reconciled) return;

    setDefinition(reconciled.definition);
    // Empty for a de-duplication-only fix — the selection still means what the user picked, no prompt.
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
