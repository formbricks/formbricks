"use client";

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { creativeKeys } from "../lib/editor-api";
import {
  ACTIVE_CREATIVES_LIMIT,
  type TCreativeListItem,
  type TCreativeListPage,
  archiveCreative,
  creativeListKeys,
  deleteCreative,
  duplicateCreative,
  flattenCreativePages,
  listCreatives,
  restoreCreative,
} from "../lib/list-api";
import { INITIAL_CREATIVE_FILTERS, type TCreativeListFilters } from "../lib/list-filters";

export const useCreativesList = ({
  workspaceId,
  limit,
  filters,
  enabled,
}: {
  workspaceId: string;
  limit: number;
  filters: TCreativeListFilters;
  enabled: boolean;
}) => {
  const query = useInfiniteQuery({
    queryKey: creativeListKeys.page({ workspaceId, limit, filters }),
    initialPageParam: null as string | null,
    enabled,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam, signal }) =>
      listCreatives({ workspaceId, limit, cursor: pageParam, filters, signal }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });

  // One array per fetched page set: the table re-renders whenever its `data` changes identity.
  const creatives = useMemo(() => flattenCreativePages(query.data), [query.data]);
  return { ...query, creatives };
};

const ACTIVE_FILTERS: TCreativeListFilters = { ...INITIAL_CREATIVE_FILTERS, displayStatuses: ["active"] };
const selectCreatives = (page: TCreativeListPage) => page.data;

/**
 * Every Active creative in the workspace, whatever the list shows, because an overlap can involve a
 * row that is filtered out or not loaded yet. One page at the API's ceiling; a workspace with more
 * Active creatives than that gets its overlaps checked among the most recently updated ones.
 */
export const useActiveCreatives = (workspaceId: string) =>
  useQuery({
    queryKey: creativeListKeys.active(workspaceId),
    queryFn: ({ signal }) =>
      listCreatives({ workspaceId, limit: ACTIVE_CREATIVES_LIMIT, filters: ACTIVE_FILTERS, signal }),
    select: selectCreatives,
  });

/** The row menu's actions. Each refreshes every list query, the overlap check included, once it settles. */
export const useCreativeRowActions = () => {
  const queryClient = useQueryClient();
  const onSettled = () => queryClient.invalidateQueries({ queryKey: creativeListKeys.all });
  // The summary reads the creative under the same key, so it shows the archive or restore too.
  const onChanged = (creative: TCreativeListItem) =>
    queryClient.setQueryData(creativeKeys.detail(creative.id), creative);

  return {
    duplicate: useMutation({ mutationFn: duplicateCreative, onSettled }),
    archive: useMutation({ mutationFn: archiveCreative, onSuccess: onChanged, onSettled }),
    restore: useMutation({ mutationFn: restoreCreative, onSuccess: onChanged, onSettled }),
    remove: useMutation({
      mutationFn: deleteCreative,
      onSuccess: (_, creativeId) => queryClient.removeQueries({ queryKey: creativeKeys.detail(creativeId) }),
      onSettled,
    }),
  };
};
