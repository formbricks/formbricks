"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRetentionPolicies, updateRetentionPolicies } from "../lib/api-client";
import { retentionPolicyKeys } from "../lib/query";
import type { TRetentionPoliciesPatch } from "../types";

/** The organisation's three policies. */
export const useRetentionPolicies = ({ organizationId }: Readonly<{ organizationId: string }>) =>
  useQuery({
    queryKey: retentionPolicyKeys.detail(organizationId),
    queryFn: ({ signal }) => getRetentionPolicies({ organizationId, signal }),
  });

/**
 * Change one policy. The response is the whole document, so it replaces the cached one without a
 * refetch; on failure the cache is refetched in case the server state moved.
 */
export const useUpdateRetentionPolicy = ({ organizationId }: Readonly<{ organizationId: string }>) => {
  const queryClient = useQueryClient();
  const queryKey = retentionPolicyKeys.detail(organizationId);
  return useMutation({
    mutationFn: (patch: TRetentionPoliciesPatch) => updateRetentionPolicies({ organizationId, patch }),
    onSuccess: (policies) => queryClient.setQueryData(queryKey, policies),
    onError: () => queryClient.invalidateQueries({ queryKey }),
  });
};
