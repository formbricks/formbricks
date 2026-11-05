import type { CreativeStatsZodType } from "@formbricks/api-v3-schemas";
import { readCreativesApiData, requestCreativesApi } from "./creatives-api-client";

/**
 * The summary page's stats call and its query keys. It reads and patches the creative itself through
 * `editor-api.ts` (the same `creativeKeys.detail` the editor uses) and refreshes the list by
 * invalidating `creativeListKeys.all`.
 */

export type TCreativeStats = CreativeStatsZodType;

export const creativeStatsKeys = {
  all: ["creatives", "stats"] as const,
  /** Keyed by the query string, so a range that rolls into a new UTC day is a new query. */
  range: (creativeId: string, query: string) => [...creativeStatsKeys.all, creativeId, query] as const,
};

/** `GET /api/v3/creatives/{id}/stats` with the query `buildCreativeStatsSearchParams` builds. */
export const getCreativeStats = async (
  creativeId: string,
  query: string,
  signal?: AbortSignal
): Promise<TCreativeStats> =>
  readCreativesApiData(
    await requestCreativesApi({ path: [creativeId, "stats"], query: new URLSearchParams(query), signal })
  );
