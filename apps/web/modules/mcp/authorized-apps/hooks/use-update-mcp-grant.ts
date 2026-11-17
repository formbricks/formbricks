"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TRequestedMcpGrant } from "@/modules/mcp/grant";
import { updateMcpGrant } from "../lib/api-client";
import { authorizedMcpClientKeys } from "../lib/query";

/**
 * Edit's Save: replaces an MCP client's permissions and, when given, its organization & workspace access,
 * then refreshes the list's summary, chips and dates. Sends the grant version Edit opened, so a save over a
 * change made in another tab or session is refused.
 *
 * The list is refreshed when the save settles, failed or not: a refusal means Edit opened on something
 * since changed, and the client gives up after 15 s (`api-client.ts`) while the server, waiting behind a
 * reconciling pass, can still commit the save. Edit keeps its draft and the version it opened across the
 * refetch (`use-mcp-grant-edit.ts`), so a retry over a save that did commit is refused as stale.
 */
export const useUpdateMcpGrant = () => {
  const queryClient = useQueryClient();
  const refreshList = () => queryClient.invalidateQueries({ queryKey: authorizedMcpClientKeys.list() });
  return useMutation({
    mutationFn: (variables: { clientId: string; grant: TRequestedMcpGrant; expectedUpdatedAt: string }) =>
      updateMcpGrant(variables),
    onSettled: refreshList,
  });
};
