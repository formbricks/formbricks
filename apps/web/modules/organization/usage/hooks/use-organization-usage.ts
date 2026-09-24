"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getOrganizationUsage } from "../lib/api-client";
import { organizationUsageKeys } from "../lib/query";
import type { TUsageRangeQuery } from "../lib/range";

const USAGE_STALE_TIME_MS = 60_000;

/**
 * The Usage page's numbers for one range. Every range change is a new key, and counts move slowly, so a
 * range seen in the last minute is served from cache without a refetch; the previous numbers stay on
 * screen while a new range loads.
 */
export const useOrganizationUsage = ({
  organizationId,
  range,
}: Readonly<{ organizationId: string; range: TUsageRangeQuery }>) =>
  useQuery({
    queryKey: organizationUsageKeys.usage(organizationId, range),
    queryFn: ({ signal }) => getOrganizationUsage({ organizationId, range, signal }),
    placeholderData: keepPreviousData,
    staleTime: USAGE_STALE_TIME_MS,
  });
