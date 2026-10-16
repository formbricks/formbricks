import type { CreativeStatsZodType } from "@formbricks/api-v3-schemas";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";

/**
 * The summary page's query keys and its stats call. It reads and patches the creative through the
 * editor's calls (`editor-api.ts`) and refreshes the list by invalidating `creativeListKeys.all`.
 */

export type TCreativeStats = CreativeStatsZodType;

export const creativeSummaryKeys = {
  all: ["creatives", "summary"] as const,
  creative: (creativeId: string) => [...creativeSummaryKeys.all, creativeId, "creative"] as const,
  /** Keyed by the query string, so a range that rolls into a new UTC day is a new query. */
  stats: (creativeId: string, query: string) =>
    [...creativeSummaryKeys.all, creativeId, "stats", query] as const,
};

/** `GET /api/v3/creatives/{id}/stats` with the query `buildCreativeStatsSearchParams` builds. */
export const getCreativeStats = async (
  creativeId: string,
  query: string,
  signal?: AbortSignal
): Promise<TCreativeStats> => {
  const response = await fetch(`/api/v3/creatives/${encodeURIComponent(creativeId)}/stats?${query}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return ((await response.json()) as { data: TCreativeStats }).data;
};
