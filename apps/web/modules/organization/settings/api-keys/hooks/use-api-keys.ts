"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TApiKeyCreateBody, TApiKeyUpdateBody } from "@/app/api/internal/api-keys/schemas";
import type { TApiKeyResource } from "@/app/api/internal/api-keys/serializers";
import { createApiKey, deleteApiKey, updateApiKey } from "../lib/api-client";
import { apiKeyKeys, apiKeyListQueryOptions } from "../lib/query";

/** The organization's API keys. The page prefetches them on the server, so this starts filled. */
export const useApiKeys = (organizationId: string) => useQuery(apiKeyListQueryOptions(organizationId));

/**
 * Mint a key. The created key is added to the list as soon as the server answers; the plaintext `apiKey`
 * in the result is the caller's to show and is never put in the cache, so a refetch can't drop it from
 * view and nothing else can read it.
 */
export const useCreateApiKey = (organizationId: string) => {
  const queryClient = useQueryClient();
  const queryKey = apiKeyKeys.list(organizationId);
  return useMutation({
    mutationFn: (body: TApiKeyCreateBody) => createApiKey({ organizationId, body }),
    onSuccess: ({ apiKey: _plaintext, ...created }) => {
      queryClient.setQueryData<TApiKeyResource[]>(queryKey, (keys) => [...(keys ?? []), created]);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
};

/** Rename a key. The response is the updated key, which replaces the cached one. */
export const useUpdateApiKey = (organizationId: string) => {
  const queryClient = useQueryClient();
  const queryKey = apiKeyKeys.list(organizationId);
  return useMutation({
    mutationFn: ({ apiKeyId, body }: { apiKeyId: string; body: TApiKeyUpdateBody }) =>
      updateApiKey({ apiKeyId, body }),
    onSuccess: (updated) => {
      queryClient.setQueryData<TApiKeyResource[]>(queryKey, (keys) =>
        keys?.map((key) => (key.id === updated.id ? updated : key))
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
};

/** Revoke a key. Removed from the list at once, and put back if the server refuses. */
export const useDeleteApiKey = (organizationId: string) => {
  const queryClient = useQueryClient();
  const queryKey = apiKeyKeys.list(organizationId);
  return useMutation({
    mutationFn: (apiKeyId: string) => deleteApiKey(apiKeyId),
    onMutate: async (apiKeyId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TApiKeyResource[]>(queryKey);
      queryClient.setQueryData<TApiKeyResource[]>(queryKey, (keys) =>
        keys?.filter((key) => key.id !== apiKeyId)
      );
      return { previous };
    },
    onError: (_error, _apiKeyId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
};
