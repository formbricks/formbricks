import type { InfiniteData } from "@tanstack/react-query";
import type { CreativeListMetaZodType, CreativeResourceZodType } from "@formbricks/api-v3-schemas";
import { readCreativesApiData, requestCreativesApi } from "./creatives-api-client";
import type { TCreativeListFilters } from "./list-filters";

// The Creatives list's calls to `/api/v3/creatives` and its TanStack Query keys. The editor keeps its
// own calls and keys; it refreshes this list by invalidating `creativeListKeys.all`.

export type TCreativeListItem = CreativeResourceZodType;

export interface TCreativeListPage {
  data: TCreativeListItem[];
  meta: CreativeListMetaZodType;
}

/** The API's page-size ceiling, used to read every Active creative for the overlap warning in one call. */
export const ACTIVE_CREATIVES_LIMIT = 250;

export const creativeListKeys = {
  all: ["creatives", "list"] as const,
  page: (input: { workspaceId: string; limit: number; filters: TCreativeListFilters }) =>
    [...creativeListKeys.all, "page", input] as const,
  active: (workspaceId: string) => [...creativeListKeys.all, "active", workspaceId] as const,
};

export const buildCreativeListSearchParams = ({
  workspaceId,
  limit,
  cursor,
  filters,
}: {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
  filters: TCreativeListFilters;
}): URLSearchParams => {
  const params = new URLSearchParams({ workspaceId, limit: String(limit), sortBy: filters.sortBy });
  const name = filters.name.trim();
  if (name) params.set("filter[name][contains]", name);
  filters.displayStatuses.forEach((status) => params.append("filter[displayStatus][in]", status));
  filters.types.forEach((type) => params.append("filter[type][in]", type));
  if (cursor) params.set("cursor", cursor);
  return params;
};

export const listCreatives = async (input: {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
  filters: TCreativeListFilters;
  signal?: AbortSignal;
}): Promise<TCreativeListPage> => {
  const response = await requestCreativesApi({
    query: buildCreativeListSearchParams(input),
    signal: input.signal,
  });
  return (await response.json()) as TCreativeListPage;
};

export const flattenCreativePages = (data?: InfiniteData<TCreativeListPage>): TCreativeListItem[] =>
  data?.pages.flatMap((page) => page.data) ?? [];

const sendCreativeAction = async (
  creativeId: string,
  action: "duplicate" | "archive" | "restore"
): Promise<TCreativeListItem> =>
  readCreativesApiData(await requestCreativesApi({ path: [creativeId, action], method: "POST" }));

export const duplicateCreative = (creativeId: string) => sendCreativeAction(creativeId, "duplicate");

export const archiveCreative = (creativeId: string) => sendCreativeAction(creativeId, "archive");

export const restoreCreative = (creativeId: string) => sendCreativeAction(creativeId, "restore");

export const deleteCreative = async (creativeId: string): Promise<void> => {
  await requestCreativesApi({ path: [creativeId], method: "DELETE" });
};
