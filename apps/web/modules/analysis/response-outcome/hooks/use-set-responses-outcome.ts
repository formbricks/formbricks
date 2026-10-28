"use client";

import { useMutation } from "@tanstack/react-query";
import type { TResponseOutcome } from "@formbricks/types/responses";
import {
  OutcomeBatchError,
  setOutcomeInBatches,
  setResponseOutcome,
  setResponsesOutcomeBatch,
} from "../lib/client";
import type { TOutcomeChanges } from "../lib/outcome";

type TVariables = {
  ids: string[];
  outcome: TResponseOutcome | null;
  /** What the rows carried when the action was clicked, so a refusal can put it back. */
  previous: TOutcomeChanges;
};

/**
 * Marks or restores responses. The list shows the new outcome at once (`applyOutcomes` patches the page's
 * own list); a refusal puts back what was not saved. One response is a PATCH, anything more goes through
 * the batch route in calls of up to 100.
 */
export const useSetResponsesOutcome = ({
  workspaceId,
  applyOutcomes,
  onSaved,
  onFailed,
}: {
  workspaceId: string;
  applyOutcomes: (changes: TOutcomeChanges) => void;
  /**
   * Hook-level rather than per-`mutate` on purpose: the selection bar unmounts the moment the selection
   * clears, and per-call callbacks do not run for an unmounted component, so the toast would be lost.
   */
  onSaved?: (result: { updated: number }, variables: TVariables) => void;
  onFailed?: (error: unknown, variables: TVariables) => void;
}) =>
  useMutation({
    mutationFn: async ({ ids, outcome }: TVariables) => {
      if (ids.length === 1) {
        await setResponseOutcome(ids[0], outcome);
        return { updated: 1 };
      }
      const { updated } = await setOutcomeInBatches(ids, (chunk) =>
        setResponsesOutcomeBatch(workspaceId, chunk, outcome)
      );
      return { updated };
    },
    onMutate: ({ ids, outcome }) => {
      applyOutcomes(Object.fromEntries(ids.map((id) => [id, outcome])));
    },
    onError: (error, { ids, outcome, previous }) => {
      const saved = new Set(error instanceof OutcomeBatchError ? error.doneIds : []);
      const unsaved = ids.filter((id) => !saved.has(id) && id in previous);
      applyOutcomes(Object.fromEntries(unsaved.map((id) => [id, previous[id]])));
      onFailed?.(error, { ids, outcome, previous });
    },
    onSuccess: (result, variables) => onSaved?.(result, variables),
  });
