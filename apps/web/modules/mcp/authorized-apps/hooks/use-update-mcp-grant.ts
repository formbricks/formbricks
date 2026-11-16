"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { MCP_GRANT_CHANGED_CODE } from "@/modules/auth/lib/mcp-grant-consent-errors";
import type { TMcpGrantAccessSelection, TMcpGrantPermissions } from "@/modules/mcp/grant";
import { updateMcpGrant } from "../lib/api-client";
import { authorizedMcpClientKeys } from "../lib/query";

/** Whether a save was refused because the grant changed elsewhere since Edit opened it. */
export const isMcpGrantChangedError = (error: unknown): boolean =>
  error instanceof V3ApiError && error.code === MCP_GRANT_CHANGED_CODE;

/**
 * Edit's Save: replaces an MCP client's permissions and, when given, its organization & workspace access,
 * then refreshes the list's summary, chips and dates. Sends the grant version Edit opened, so a save over a
 * change made in another tab or session is refused; the list is then refreshed too, to show that change.
 */
export const useUpdateMcpGrant = () => {
  const queryClient = useQueryClient();
  const refreshList = () => queryClient.invalidateQueries({ queryKey: authorizedMcpClientKeys.list() });
  return useMutation({
    mutationFn: (variables: {
      clientId: string;
      permissions: TMcpGrantPermissions;
      access?: TMcpGrantAccessSelection;
      expectedUpdatedAt: string;
    }) => updateMcpGrant(variables),
    onSuccess: refreshList,
    onError: async (error) => {
      if (isMcpGrantChangedError(error)) await refreshList();
    },
  });
};
