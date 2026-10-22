"use client";

import { BarChart3Icon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { formatDate, timeSinceDate } from "@/lib/time";
import { ListLoadError } from "@/modules/ee/analysis/components/list-load-error";
import { LoadMoreOnScroll } from "@/modules/ee/analysis/components/load-more-on-scroll";
import { useDashboards } from "../hooks/use-dashboards";
import { CreateDashboardButton } from "./create-dashboard-button";
import { DashboardDropdownMenu } from "./dashboard-dropdown-menu";
import { DashboardsListSkeleton } from "./dashboards-list-skeleton";

/** Rows per page: enough to fill a screen, few enough that the first paint stays fast. */
const DASHBOARDS_PAGE_SIZE = 25;

interface DashboardsTableProps {
  workspaceId: string;
  isReadOnly: boolean;
}

export const DashboardsTable = ({ workspaceId, isReadOnly }: Readonly<DashboardsTableProps>) => {
  const { t } = useTranslation();
  const { dashboards, isPending, isError, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useDashboards({ workspaceId, limit: DASHBOARDS_PAGE_SIZE });

  const columnHeaders = [
    t("common.title"),
    t("common.charts"),
    t("common.created_by"),
    t("common.created"),
    t("common.updated"),
  ];

  if (isPending) return <DashboardsListSkeleton columnHeaders={columnHeaders} />;
  if (isError) return <ListLoadError error={error} onRetry={refetch} />;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="grid h-12 grid-cols-8 content-center border-b text-left text-sm font-semibold text-slate-900">
        <div className="col-span-3 pl-6">{columnHeaders[0]}</div>
        {columnHeaders.slice(1).map((header) => (
          <div key={header} className="col-span-1 hidden text-center sm:block">
            {header}
          </div>
        ))}
        <div className="col-span-1" />
      </div>
      {dashboards.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-900">
              {t("workspace.analysis.dashboards.no_dashboards_found")}
            </p>
            <p className="text-sm text-slate-500">
              {t("workspace.analysis.dashboards.no_dashboards_found_description")}
            </p>
          </div>
          {!isReadOnly && (
            <CreateDashboardButton workspaceId={workspaceId} buttonProps={{ variant: "secondary" }} />
          )}
        </div>
      ) : (
        <>
          {dashboards.map((dashboard) => (
            <div
              key={dashboard.id}
              className="grid h-12 w-full grid-cols-8 content-center text-left transition-colors ease-in-out hover:bg-slate-100">
              <Link
                href={`/workspaces/${workspaceId}/dashboards/${dashboard.id}`}
                className="col-span-7 grid cursor-pointer grid-cols-7 content-center p-2">
                <div className="col-span-3 flex items-center pl-6 text-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-8 shrink-0 text-slate-500">
                      <BarChart3Icon className="size-5" />
                    </div>
                    <div className="font-medium text-slate-900">{dashboard.name}</div>
                  </div>
                </div>
                <div className="col-span-1 my-auto hidden text-center text-sm whitespace-nowrap text-slate-500 sm:block">
                  <div className="text-slate-900">{dashboard.widgetCount}</div>
                </div>
                <div className="col-span-1 my-auto hidden text-center text-sm whitespace-nowrap text-slate-500 sm:block">
                  <div className="text-slate-900">{dashboard.creator?.name || "-"}</div>
                </div>
                <div className="col-span-1 my-auto hidden text-center text-sm whitespace-normal text-slate-500 sm:block">
                  <div className="text-slate-900">{formatDate(dashboard.createdAt)}</div>
                </div>
                <div className="col-span-1 my-auto hidden text-center text-sm text-slate-500 sm:block">
                  <div className="text-slate-900">{timeSinceDate(dashboard.updatedAt)}</div>
                </div>
              </Link>
              <div className="col-span-1 my-auto flex items-center justify-end pr-6">
                {!isReadOnly && (
                  <DashboardDropdownMenu
                    workspaceId={workspaceId}
                    dashboardId={dashboard.id}
                    dashboardName={dashboard.name}
                  />
                )}
              </div>
            </div>
          ))}
          <LoadMoreOnScroll
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
          />
        </>
      )}
    </div>
  );
};
