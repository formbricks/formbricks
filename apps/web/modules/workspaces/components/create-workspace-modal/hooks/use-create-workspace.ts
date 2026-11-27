"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type TWorkspaceCreateInput,
  createWorkspace,
  workspaceListKeys,
} from "@/modules/workspaces/lib/workspaces-query";

/**
 * Create a workspace in the organization. On success the switchers' lists of that organization's
 * workspaces are stale, so they are invalidated. (The copy-survey picker lives under the surveys page's own
 * query client and refetches on every open.)
 */
export const useCreateWorkspace = (organizationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TWorkspaceCreateInput) => createWorkspace(organizationId, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceListKeys.organization(organizationId) }),
  });
};
