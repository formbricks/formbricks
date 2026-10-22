"use client";

import { useQuery } from "@tanstack/react-query";
import { listDashboards } from "@/modules/ee/analysis/lib/api-client";
import { dashboardKeys } from "@/modules/ee/analysis/lib/query";

/** As many dashboards as one page of the v3 list holds — far more than a picker can usefully show. */
export const DASHBOARD_OPTIONS_LIMIT = 250;

/** The workspace's dashboards to pick from when adding a chart to one, newest first. */
export const useDashboardOptions = ({ workspaceId, enabled }: { workspaceId: string; enabled: boolean }) =>
  useQuery({
    queryKey: dashboardKeys.options(workspaceId),
    enabled,
    queryFn: async ({ signal }) =>
      (await listDashboards({ workspaceId, limit: DASHBOARD_OPTIONS_LIMIT, signal })).data.map(
        ({ id, name }) => ({ id, name })
      ),
  });
