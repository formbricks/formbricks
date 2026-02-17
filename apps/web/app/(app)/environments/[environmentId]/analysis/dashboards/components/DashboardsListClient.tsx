"use client";

import { format, formatDistanceToNow } from "date-fns";
import { BarChart3Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TDashboard } from "../../types/analysis";
import { DashboardDropdownMenu } from "./DashboardDropdownMenu";

interface DashboardsListClientProps {
  dashboards: TDashboard[];
  environmentId: string;
}

export function DashboardsListClient({
  dashboards: initialDashboards,
  environmentId,
}: DashboardsListClientProps) {
  const [searchQuery, _setSearchQuery] = useState("");
  const [dashboards, setDashboards] = useState(initialDashboards);

  const filteredDashboards = dashboards.filter((dashboard) =>
    dashboard.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const deleteDashboard = (dashboardId: string) => {
    setDashboards(dashboards.filter((d) => d.id !== dashboardId));
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid h-12 grid-cols-8 content-center border-b text-left text-sm font-semibold text-slate-900">
        <div className="col-span-3 pl-6">Title</div>
        <div className="col-span-1 hidden text-center sm:block">Charts</div>
        <div className="col-span-1 hidden text-center sm:block">Created By</div>
        <div className="col-span-1 hidden text-center sm:block">Created</div>
        <div className="col-span-1 hidden text-center sm:block">Updated</div>
        <div className="col-span-1"></div>
      </div>
      {filteredDashboards.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No dashboards found.</p>
      ) : (
        <>
          {filteredDashboards.map((dashboard) => (
            <Link
              key={dashboard.id}
              href={`dashboard/${dashboard.id}`}
              className="grid h-12 w-full cursor-pointer grid-cols-8 content-center p-2 text-left transition-colors ease-in-out hover:bg-slate-100">
              <div className="col-span-3 flex items-center pl-6 text-sm">
                <div className="flex items-center gap-4">
                  <div className="ph-no-capture w-8 flex-shrink-0 text-slate-500">
                    <BarChart3Icon className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <div className="ph-no-capture font-medium text-slate-900">{dashboard.name}</div>
                    {dashboard.description && (
                      <div className="ph-no-capture text-xs font-medium text-slate-500">
                        {dashboard.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-span-1 my-auto hidden text-center text-sm whitespace-nowrap text-slate-500 sm:block">
                <div className="ph-no-capture text-slate-900">{dashboard.chartCount}</div>
              </div>
              <div className="col-span-1 my-auto hidden text-center text-sm whitespace-nowrap text-slate-500 sm:block">
                <div className="ph-no-capture text-slate-900">{dashboard.createdByName || "-"}</div>
              </div>
              <div className="col-span-1 my-auto hidden text-center text-sm whitespace-normal text-slate-500 sm:block">
                <div className="ph-no-capture text-slate-900">
                  {format(new Date(dashboard.createdAt), "do 'of' MMMM, yyyy")}
                </div>
              </div>
              <div className="col-span-1 my-auto hidden text-center text-sm text-slate-500 sm:block">
                <div className="ph-no-capture text-slate-900">
                  {formatDistanceToNow(new Date(dashboard.updatedAt), {
                    addSuffix: true,
                  }).replace("about", "")}
                </div>
              </div>
              <div
                className="col-span-1 my-auto flex items-center justify-end pr-6"
                onClick={(e) => e.stopPropagation()}>
                <DashboardDropdownMenu
                  environmentId={environmentId}
                  dashboard={dashboard}
                  deleteDashboard={deleteDashboard}
                />
              </div>
            </Link>
          ))}
        </>
      )}
    </div>
  );
}
