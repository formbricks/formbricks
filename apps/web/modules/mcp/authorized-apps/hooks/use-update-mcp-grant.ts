"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TMcpGrantPermissions } from "@/modules/mcp/grant";
import { updateMcpGrant } from "../lib/api-client";
import { mcpConnectionKeys } from "../lib/query";

/** Edit's Save: replaces a connection's permissions, then refreshes the list's chips and dates. */
export const useUpdateMcpGrant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { clientId: string; permissions: TMcpGrantPermissions }) =>
      updateMcpGrant(variables),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mcpConnectionKeys.list() }),
  });
};
