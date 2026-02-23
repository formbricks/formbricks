import { BarChart3Icon } from "lucide-react";
import Link from "next/link";
import { convertDateString, timeSinceDate } from "@/lib/time";
import { getTranslate } from "@/lingodotdev/server";
import { TDashboardWithCount } from "../../types/analysis";
import { DashboardDropdownMenu } from "./dashboard-dropdown-menu";

interface DashboardsTableProps {
  dashboards: TDashboardWithCount[];
  environmentId: string;
  isReadOnly: boolean;
  userMap: Map<string, string | null>;
}

export const DashboardsTable = async ({
  dashboards,
  environmentId,
  isReadOnly,
  userMap,
}: Readonly<DashboardsTableProps>) => {
  const t = await getTranslate();

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid h-12 grid-cols-8 content-center border-b text-left text-sm font-semibold text-slate-900">
        <div className="col-span-3 pl-6">{t("common.title")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.charts")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.created_by")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.created")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.updated")}</div>
        <div className="col-span-1" />
      </div>
      {dashboards.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          {t("environments.analysis.dashboards.no_dashboards_found")}
        </p>
      ) : (
        dashboards.map((dashboard) => {
          const createdByName = dashboard.createdBy ? (userMap.get(dashboard.createdBy) ?? null) : null;

          return (
            <Link
              key={dashboard.id}
              href={`/environments/${environmentId}/analysis/dashboards/${dashboard.id}`}
              className="grid h-12 w-full cursor-pointer grid-cols-8 content-center p-2 text-left transition-colors ease-in-out hover:bg-slate-100">
              <div className="col-span-3 flex items-center pl-6 text-sm">
                <div className="flex items-center gap-4">
                  <div className="w-8 flex-shrink-0 text-slate-500">
                    <BarChart3Icon className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <div className="font-medium text-slate-900">{dashboard.name}</div>
                    {dashboard.description && (
                      <div className="text-xs font-medium text-slate-500">{dashboard.description}</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-span-1 my-auto hidden whitespace-nowrap text-center text-sm text-slate-500 sm:block">
                <div className="text-slate-900">{dashboard._count.widgets}</div>
              </div>
              <div className="col-span-1 my-auto hidden whitespace-nowrap text-center text-sm text-slate-500 sm:block">
                <div className="text-slate-900">{createdByName || "-"}</div>
              </div>
              <div className="col-span-1 my-auto hidden whitespace-normal text-center text-sm text-slate-500 sm:block">
                <div className="text-slate-900">{convertDateString(dashboard.createdAt.toISOString())}</div>
              </div>
              <div className="col-span-1 my-auto hidden text-center text-sm text-slate-500 sm:block">
                <div className="text-slate-900">{timeSinceDate(dashboard.updatedAt)}</div>
              </div>
              <div className="col-span-1 my-auto flex items-center justify-end pr-6">
                {!isReadOnly && (
                  <DashboardDropdownMenu
                    environmentId={environmentId}
                    dashboardId={dashboard.id}
                    dashboardName={dashboard.name}
                  />
                )}
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
};
