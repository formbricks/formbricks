"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getOrganizationUsage } from "../lib/api-client";
import { organizationUsageKeys } from "../lib/query";
import type { TUsageRangeQuery } from "../lib/range";

/**
 * The Usage page's numbers for one range. Every range change is a new key, so switching back to a range
 * already seen is instant; the previous numbers stay on screen while the next ones load.
 */
export const useOrganizationUsage = ({
  organizationId,
  range,
}: Readonly<{ organizationId: string; range: TUsageRangeQuery }>) =>
  useQuery({
    queryKey: organizationUsageKeys.usage(organizationId, range),
    queryFn: ({ signal }) => getOrganizationUsage({ organizationId, range, signal }),
    placeholderData: keepPreviousData,
  });
