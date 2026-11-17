"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TRequestedMcpGrant } from "@/modules/mcp/grant";
import { updateMcpGrant } from "../lib/api-client";
import { isStaleMcpGrantEditError } from "../lib/edit-grant";
import { authorizedMcpClientKeys } from "../lib/query";

/**
 * Edit's Save: replaces an MCP client's permissions and, when given, its organization & workspace access,
 * then refreshes the list's summary, chips and dates. Sends the grant version Edit opened, so a save over a
 * change made in another tab or session is refused; the list is then refreshed too, to show that change,
 * as it is for any refusal that means Edit opened on something since changed (`isStaleMcpGrantEditError`).
 */
export const useUpdateMcpGrant = () => {
  const queryClient = useQueryClient();
  const refreshList = () => queryClient.invalidateQueries({ queryKey: authorizedMcpClientKeys.list() });
  return useMutation({
    mutationFn: (variables: { clientId: string; grant: TRequestedMcpGrant; expectedUpdatedAt: string }) =>
      updateMcpGrant(variables),
    onSuccess: refreshList,
    onError: async (error) => {
      if (isStaleMcpGrantEditError(error)) await refreshList();
    },
  });
};
