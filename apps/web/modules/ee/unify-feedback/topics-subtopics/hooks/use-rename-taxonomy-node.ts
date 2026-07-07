"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { renameTaxonomyNode } from "../lib/api-client";
import { type TTaxonomyScopeSelection, taxonomyKeys } from "../lib/query";

/** Rename a taxonomy node, then invalidate `state` to pull the updated tree. */
export const useRenameTaxonomyNode = ({
  workspaceId,
  scope,
}: Readonly<{ workspaceId: string; scope: TTaxonomyScopeSelection | null }>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { nodeId: string; label: string }) => {
      if (!scope) {
        throw new Error("scope is required");
      }
      return renameTaxonomyNode({
        workspaceId,
        directoryId: scope.directoryId,
        nodeId: variables.nodeId,
        label: variables.label,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taxonomyKeys.state(workspaceId, scope) }),
  });
};
