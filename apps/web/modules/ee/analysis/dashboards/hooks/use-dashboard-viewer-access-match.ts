"use client";

import { useQuery } from "@tanstack/react-query";
import { buildApiUrl, getApiData } from "@/modules/api/lib/internal-api-client";
import { type TAppDashboard, VIEW_AS_PARAM, getViewAsUserId } from "@/modules/ee/analysis/lib/api-client";
import { dashboardKeys } from "@/modules/ee/analysis/lib/query";

type TViewerAccessStatus = NonNullable<TAppDashboard["viewerAccess"]>["status"];

/** As long as the server reuses a probe's answer, so the page asks no more often than it can change. */
const VIEWER_ACCESS_MATCH_STALE_MS = 60_000;

/** Under the dashboard's detail key, so a widget change (a chart on another dataset) asks again. */
/** Keyed by the View as member too, so one member's answer is never shown while viewing as another. */
export const viewerAccessMatchKey = (dashboardId: string, viewAs: string | null) =>
  [...dashboardKeys.detail(dashboardId), "viewerAccessMatch", viewAs] as const;

/** Whether the reader's Dashboard Viewer access matches any record on the dashboard, as the page's View as member. */
export const getDashboardViewerAccessMatch = async (
  dashboardId: string,
  signal?: AbortSignal
): Promise<TViewerAccessStatus> => {
  const url = buildApiUrl(`/api/internal/dashboards/${encodeURIComponent(dashboardId)}/viewer-access`, {
    [VIEW_AS_PARAM]: getViewAsUserId(),
  });
  const { status } = await getApiData<{ status: TViewerAccessStatus }>(url, { signal });
  return status;
};

/**
 * Whether a Dashboard Viewer's access leaves them nothing on the dashboard. The dashboard read answers
 * from their conditions alone (`unmatched` only when they hold no value); when it says `restricted`, the
 * record check runs here, after the dashboard has drawn, and turns it `unmatched` when no record matches.
 * A failed check leaves the charts showing: each carries the viewer's access itself.
 */
export const useDashboardViewerAccessMatch = ({
  dashboardId,
  status,
}: {
  dashboardId: string;
  status: TViewerAccessStatus | undefined;
}): { isUnmatched: boolean } => {
  const match = useQuery({
    queryKey: viewerAccessMatchKey(dashboardId, getViewAsUserId()),
    enabled: status === "restricted",
    staleTime: VIEWER_ACCESS_MATCH_STALE_MS,
    retry: false,
    queryFn: ({ signal }) => getDashboardViewerAccessMatch(dashboardId, signal),
  });
  return { isUnmatched: status === "unmatched" || (status === "restricted" && match.data === "unmatched") };
};
