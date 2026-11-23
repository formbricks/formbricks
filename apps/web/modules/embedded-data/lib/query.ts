import { queryOptions } from "@tanstack/react-query";
import { QUERY_RETRY } from "@/modules/api/lib/query-client";
import { getEmbeddedDataUsage, listEmbeddedData } from "./api-client";

export const embeddedDataKeys = {
  all: ["embedded-data"] as const,
  lists: () => [...embeddedDataKeys.all, "list"] as const,
  list: (workspaceId: string) => [...embeddedDataKeys.lists(), workspaceId] as const,
  usages: () => [...embeddedDataKeys.all, "usage"] as const,
  usage: (id: string) => [...embeddedDataKeys.usages(), id] as const,
};

/**
 * A workspace's shared library. The settings page fills it on the server; the editor fetches it. Both
 * queries carry the app's retry rule themselves, because the survey editor's client retries everything,
 * a 403 included.
 */
export const embeddedDataListQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: embeddedDataKeys.list(workspaceId),
    queryFn: ({ signal }) => listEmbeddedData(workspaceId, { signal }),
    ...QUERY_RETRY,
  });

/** The surveys linking one field — fetched when its popover opens, not with the list. */
export const embeddedDataUsageQueryOptions = (id: string) =>
  queryOptions({
    queryKey: embeddedDataKeys.usage(id),
    queryFn: ({ signal }) => getEmbeddedDataUsage(id, { signal }),
    ...QUERY_RETRY,
  });
