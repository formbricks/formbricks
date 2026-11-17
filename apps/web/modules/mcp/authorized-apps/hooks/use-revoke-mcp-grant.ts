"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { revokeMcpGrant } from "../lib/api-client";
import { authorizedMcpClientKeys } from "../lib/query";

/**
 * Revoke: ends a client's grant, consent and tokens, then refreshes the list. Works for a client
 * authorized without the consent screen (`skipConsent`), which has a grant and no consent.
 *
 * The list is refreshed when the revoke settles, failed or not: the client gives up after 15 s
 * (`api-client.ts`), while the server, waiting behind a reconciling pass, can still commit the revoke.
 */
export const useRevokeMcpGrant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) => revokeMcpGrant(clientId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: authorizedMcpClientKeys.list() }),
  });
};
