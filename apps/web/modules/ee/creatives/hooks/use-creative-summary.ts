"use client";

import { keepPreviousData, queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  type TCreativeStatsRangeSelection,
  buildCreativeStatsSearchParams,
  resolveCreativeStatsRange,
} from "../lib/summary";
import { creativeStatsKeys, getCreativeStats } from "../lib/summary-api";

const creativeStatsQuery = (creativeId: string, selection: TCreativeStatsRangeSelection, now: Date) => {
  const query = buildCreativeStatsSearchParams(selection, now).toString();
  return queryOptions({
    queryKey: creativeStatsKeys.range(creativeId, query),
    queryFn: ({ signal }) => getCreativeStats(creativeId, query, signal),
  });
};

/**
 * The summary's range and its counts. "Today" is read on load, when a range is picked and on `refresh`,
 * so a rolling preset follows the UTC day: a refresh after midnight fetches the range that now ends
 * today, not the query already on screen. A new range keeps the last counts on screen until its own
 * arrive.
 */
export const useCreativeStats = (creativeId: string) => {
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<TCreativeStatsRangeSelection>({ preset: "last 30 days" });
  const [now, setNow] = useState(() => new Date());
  const stats = useQuery({
    ...creativeStatsQuery(creativeId, selection, now),
    placeholderData: keepPreviousData,
  });

  const select = (next: TCreativeStatsRangeSelection) => {
    setNow(new Date());
    setSelection(next);
  };

  /** Rejects when the counts can't be fetched. */
  const refresh = async () => {
    const refreshedAt = new Date();
    // Set before fetching, so the query this render switches to is the one in flight, not a second fetch.
    setNow(refreshedAt);
    await queryClient.fetchQuery(creativeStatsQuery(creativeId, selection, refreshedAt));
  };

  return { stats, selection, range: resolveCreativeStatsRange(selection, now), now, select, refresh };
};
