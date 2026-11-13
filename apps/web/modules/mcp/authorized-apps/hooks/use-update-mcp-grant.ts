"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TMcpGrantAccessSelection, TMcpGrantPermissions } from "@/modules/mcp/grant";
import { updateMcpGrant } from "../lib/api-client";
import { authorizedMcpClientKeys } from "../lib/query";

/**
 * Edit's Save: replaces a connection's permissions and, when given, its organization & workspace access,
 * then refreshes the list's summary, chips and dates.
 */
export const useUpdateMcpGrant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      clientId: string;
      permissions: TMcpGrantPermissions;
      access?: TMcpGrantAccessSelection;
    }) => updateMcpGrant(variables),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authorizedMcpClientKeys.list() }),
  });
};
