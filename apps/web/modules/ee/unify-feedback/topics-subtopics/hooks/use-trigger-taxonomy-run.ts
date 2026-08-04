"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InvalidInputError } from "@formbricks/types/errors";
import { triggerTaxonomyRun } from "../lib/api-client";
import { type TTaxonomyScopeSelection, taxonomyKeys } from "../lib/query";

/** Start (or resume) a taxonomy run for the selected scope, then refetch `state` whether the run
 * started or failed to start: on success the new pending run surfaces (and polling picks it up); on
 * failure the persisted failed run surfaces so its error alert renders instead of only a toast. */
export const useTriggerTaxonomyRun = ({
  workspaceId,
  scope,
}: Readonly<{ workspaceId: string; scope: TTaxonomyScopeSelection | null }>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { fieldLabel?: string }) => {
      if (!scope) {
        throw new InvalidInputError("scope is required");
      }
      return triggerTaxonomyRun({ workspaceId, ...scope, fieldLabel: variables.fieldLabel });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: taxonomyKeys.state(workspaceId, scope) }),
  });
};
