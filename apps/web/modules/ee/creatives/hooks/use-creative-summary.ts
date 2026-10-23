"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { creativeStatsKeys, getCreativeStats } from "../lib/summary-api";

/** The counts for one range. A new range keeps the last counts on screen until its own arrive. */
export const useCreativeStats = (creativeId: string, query: string) =>
  useQuery({
    queryKey: creativeStatsKeys.range(creativeId, query),
    queryFn: ({ signal }) => getCreativeStats(creativeId, query, signal),
    placeholderData: keepPreviousData,
  });
