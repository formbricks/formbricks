"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type TTaxonomyStateResponse, removeTaxonomyNode } from "../lib/api-client";
import { type TTaxonomyScopeSelection, removeNodeFromStateData, taxonomyKeys } from "../lib/query";

/** Soft-remove a node with an optimistic tree update + rollback on error, then reconcile via invalidate. */
export const useRemoveTaxonomyNode = ({
  workspaceId,
  scope,
}: Readonly<{ workspaceId: string; scope: TTaxonomyScopeSelection | null }>) => {
  const queryClient = useQueryClient();
  const stateKey = taxonomyKeys.state(workspaceId, scope);
  return useMutation({
    mutationFn: (variables: { nodeId: string }) => {
      if (!scope) {
        throw new Error("scope is required");
      }
      return removeTaxonomyNode({ workspaceId, directoryId: scope.directoryId, nodeId: variables.nodeId });
    },
    onMutate: async ({ nodeId }) => {
      await queryClient.cancelQueries({ queryKey: stateKey });
      const previous = queryClient.getQueryData<TTaxonomyStateResponse>(stateKey);
      queryClient.setQueryData<TTaxonomyStateResponse | undefined>(stateKey, (data) =>
        removeNodeFromStateData(data, nodeId)
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(stateKey, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: stateKey }),
  });
};
