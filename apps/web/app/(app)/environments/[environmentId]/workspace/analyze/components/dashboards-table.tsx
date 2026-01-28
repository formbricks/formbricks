"use client";

import { formatDistanceToNow } from "date-fns";
import { LayoutDashboardIcon } from "lucide-react";
import { TDashboard } from "./types";

interface DashboardsTableProps {
  dashboards: TDashboard[];
  onDashboardClick: (dashboard: TDashboard) => void;
}

export function DashboardsTable({ dashboards, onDashboardClick }: DashboardsTableProps) {
  if (dashboards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16">
        <LayoutDashboardIcon className="h-12 w-12 text-slate-300" />
        <p className="mt-4 text-sm font-medium text-slate-600">No dashboards yet</p>
        <p className="mt-1 text-sm text-slate-500">Create your first dashboard to start analyzing feedback</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Table Header */}
      <div className="grid h-12 grid-cols-12 content-center border-b border-slate-200 text-left text-sm font-semibold text-slate-900">
        <div className="col-span-5 pl-6">Name</div>
        <div className="col-span-3 hidden text-center sm:block">Widgets</div>
        <div className="col-span-2 hidden text-center sm:block">Updated</div>
        <div className="col-span-2 hidden pr-6 text-right sm:block">Created</div>
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-slate-100">
        {dashboards.map((dashboard) => (
          <div
            key={dashboard.id}
            role="button"
            tabIndex={0}
            className="grid h-16 cursor-pointer grid-cols-12 content-center p-2 text-left transition-colors ease-in-out hover:bg-slate-50"
            onClick={() => onDashboardClick(dashboard)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                onDashboardClick(dashboard);
              }
            }}>
            {/* Name Column */}
            <div className="col-span-5 flex items-center gap-3 pl-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100">
                <LayoutDashboardIcon className="h-4 w-4 text-slate-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-900">{dashboard.name}</span>
                {dashboard.description && (
                  <span className="truncate text-xs text-slate-500">{dashboard.description}</span>
                )}
              </div>
            </div>

            {/* Widgets Column */}
            <div className="col-span-3 hidden items-center justify-center text-sm text-slate-600 sm:flex">
              {dashboard.widgetCount} {dashboard.widgetCount === 1 ? "widget" : "widgets"}
            </div>

            {/* Updated Column */}
            <div className="col-span-2 hidden items-center justify-center text-sm text-slate-500 sm:flex">
              {formatDistanceToNow(dashboard.updatedAt, { addSuffix: true })}
            </div>

            {/* Created Column */}
            <div className="col-span-2 hidden items-center justify-end pr-4 text-sm text-slate-500 sm:flex">
              {formatDistanceToNow(dashboard.createdAt, { addSuffix: true })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
