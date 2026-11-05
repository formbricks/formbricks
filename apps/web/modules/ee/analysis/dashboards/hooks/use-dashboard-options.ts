"use client";

import { useQuery } from "@tanstack/react-query";
import { listDashboards } from "@/modules/ee/analysis/lib/api-client";
import { dashboardKeys } from "@/modules/ee/analysis/lib/query";

/** The v3 list's largest page, so a typical workspace's dashboards arrive in one request. */
export const DASHBOARD_OPTIONS_PAGE_SIZE = 250;

/** A ceiling on pages followed, so a runaway cursor cannot loop: 20 pages is 5,000 dashboards. */
export const DASHBOARD_OPTIONS_MAX_PAGES = 20;

/** The workspace's dashboards to pick from when adding a chart to one, newest first: every page of them. */
export const useDashboardOptions = ({ workspaceId, enabled }: { workspaceId: string; enabled: boolean }) =>
  useQuery({
    queryKey: dashboardKeys.options(workspaceId),
    enabled,
    queryFn: async ({ signal }) => {
      const options: { id: string; name: string }[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < DASHBOARD_OPTIONS_MAX_PAGES; page++) {
        const { data, meta } = await listDashboards({
          workspaceId,
          limit: DASHBOARD_OPTIONS_PAGE_SIZE,
          cursor,
          signal,
        });
        options.push(...data.map(({ id, name }) => ({ id, name })));
        cursor = meta.nextCursor;
        if (!cursor) break;
      }
      return options;
    },
  });
