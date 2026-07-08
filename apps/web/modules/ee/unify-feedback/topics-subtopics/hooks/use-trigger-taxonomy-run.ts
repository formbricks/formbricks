"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InvalidInputError } from "@formbricks/types/errors";
import { triggerTaxonomyRun } from "../lib/api-client";
import { type TTaxonomyScopeSelection, taxonomyKeys } from "../lib/query";

/** Start (or resume) a taxonomy run for the selected scope, then invalidate `state` so the new run
 * surfaces and run-status polling picks it up. */
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
      return triggerTaxonomyRun({
        workspaceId,
        directoryId: scope.directoryId,
        sourceType: scope.sourceType,
        sourceId: scope.sourceId,
        fieldId: scope.fieldId,
        fieldLabel: variables.fieldLabel,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taxonomyKeys.state(workspaceId, scope) }),
  });
};
