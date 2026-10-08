"use client";

import {
  type InfiniteData,
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type TRetentionExemptionListInput,
  type TRetentionExemptionListPage,
  createRetentionExemption,
  listRetentionExemptionSurveyOptions,
  listRetentionExemptions,
  revokeRetentionExemption,
} from "../lib/api-client";
import {
  type TRetentionExemptionListKey,
  flattenRetentionExemptionPages,
  removeRetentionExemptionFromPages,
  retentionExemptionKeys,
} from "../lib/query";
import type { TCreateRetentionExemptionInput } from "../types";

/** The active exemptions, newest first, one keyset page at a time ("Load more"). */
export const useRetentionExemptions = (input: TRetentionExemptionListInput) => {
  const queryKey = retentionExemptionKeys.list(input);

  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam, signal }) => listRetentionExemptions({ ...input, cursor: pageParam, signal }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });

  return { ...query, queryKey, exemptions: flattenRetentionExemptionPages(query.data) };
};

/** Create an exemption, then refetch the list so it shows in its place. */
export const useCreateRetentionExemption = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TCreateRetentionExemptionInput) => createRetentionExemption(input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: retentionExemptionKeys.lists() }),
  });
};

/** Revoke an exemption, taking it out of the list at once and putting it back if the request fails. */
export const useRevokeRetentionExemption = ({
  queryKey,
}: Readonly<{ queryKey: TRetentionExemptionListKey }>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ exemptionId }: { exemptionId: string }) => revokeRetentionExemption(exemptionId),
    onMutate: async ({ exemptionId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<InfiniteData<TRetentionExemptionListPage>>(queryKey);
      queryClient.setQueryData<InfiniteData<TRetentionExemptionListPage>>(queryKey, (data) =>
        removeRetentionExemptionFromPages(data, exemptionId)
      );
      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) queryClient.setQueryData(queryKey, context.previousData);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: retentionExemptionKeys.lists() }),
  });
};

/** Surveys the Add exemption picker offers for a search, fetched only while the picker is open. */
export const useRetentionExemptionSurveyOptions = ({
  organizationId,
  search,
  enabled,
}: Readonly<{ organizationId: string; search: string; enabled: boolean }>) =>
  useQuery({
    queryKey: retentionExemptionKeys.surveyOptions({ organizationId, search }),
    queryFn: ({ signal }) => listRetentionExemptionSurveyOptions({ organizationId, search, signal }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
