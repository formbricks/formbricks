import type { InfiniteData } from "@tanstack/react-query";
import type { CreativeListMetaZodType, CreativeResourceZodType } from "@formbricks/api-v3-schemas";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TCreativeListFilters } from "./list-filters";

// The Creatives list's calls to `/api/v3/creatives` and its TanStack Query keys. The editor keeps its
// own calls and keys; it refreshes this list by invalidating `creativeListKeys.all`.

export type TCreativeListItem = CreativeResourceZodType;

export interface TCreativeListPage {
  data: TCreativeListItem[];
  meta: CreativeListMetaZodType;
}

// Bounds a stalled row action so its pending state can't hang; the rejection shows the error toast.
const MUTATION_TIMEOUT_MS = 15_000;

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
  const response = await fetch(`/api/v3/creatives?${buildCreativeListSearchParams(input).toString()}`, {
    method: "GET",
    cache: "no-store",
    signal: input.signal,
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return (await response.json()) as TCreativeListPage;
};

export const flattenCreativePages = (data?: InfiniteData<TCreativeListPage>): TCreativeListItem[] =>
  data?.pages.flatMap((page) => page.data) ?? [];

const sendCreativeAction = async (path: string, method: "POST" | "DELETE"): Promise<Response> => {
  const response = await fetch(`/api/v3/creatives/${path}`, {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return response;
};

const readCreative = async (response: Response): Promise<TCreativeListItem> =>
  ((await response.json()) as { data: TCreativeListItem }).data;

export const duplicateCreative = async (creativeId: string) =>
  readCreative(await sendCreativeAction(`${creativeId}/duplicate`, "POST"));

export const archiveCreative = async (creativeId: string) =>
  readCreative(await sendCreativeAction(`${creativeId}/archive`, "POST"));

export const restoreCreative = async (creativeId: string) =>
  readCreative(await sendCreativeAction(`${creativeId}/restore`, "POST"));

export const deleteCreative = async (creativeId: string): Promise<void> => {
  await sendCreativeAction(creativeId, "DELETE");
};
