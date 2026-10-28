"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/modules/ee/analysis/lib/api-client";
import { dashboardKeys } from "@/modules/ee/analysis/lib/query";

/** One dashboard with its widgets and their charts — the frame the page draws before any data. */
export const useDashboard = (dashboardId: string) => {
  const queryKey = dashboardKeys.detail(dashboardId);
  return {
    ...useQuery({ queryKey, queryFn: ({ signal }) => getDashboard(dashboardId, signal) }),
    queryKey,
  };
};
