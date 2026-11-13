"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { revokeMcpGrant } from "../lib/api-client";
import { authorizedMcpClientKeys } from "../lib/query";

/**
 * Revoke: ends a client's grant, consent and tokens, then refreshes the list. Works for a client
 * authorized without the consent screen (`skipConsent`), which has a grant and no consent.
 */
export const useRevokeMcpGrant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) => revokeMcpGrant(clientId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authorizedMcpClientKeys.list() }),
  });
};
