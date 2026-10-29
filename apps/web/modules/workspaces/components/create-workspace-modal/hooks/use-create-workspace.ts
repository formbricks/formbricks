"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type TWorkspaceCreateInput,
  createWorkspace,
  workspaceListKeys,
} from "@/modules/workspaces/lib/workspaces-query";

/**
 * Create a workspace in the organization. On success every list of that organization's workspaces is
 * stale — the switchers' and the copy-survey picker's alike — so they are invalidated.
 */
export const useCreateWorkspace = (organizationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TWorkspaceCreateInput) => createWorkspace(organizationId, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceListKeys.organization(organizationId) }),
  });
};
