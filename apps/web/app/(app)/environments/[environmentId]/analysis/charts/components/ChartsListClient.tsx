"use client";

import { formatDistanceToNow } from "date-fns";
import { Edit2Icon, PlusIcon, SearchIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { TChart, TDashboard } from "../../types/analysis";

interface ChartsListClientProps {
  charts: TChart[];
  dashboards: TDashboard[];
  environmentId: string;
}

export function ChartsListClient({ charts, dashboards, environmentId }: ChartsListClientProps) {
  // Helper to find dashboard names
  const getDashboardNames = (dashboardIds: string[]) => {
    return dashboardIds
      .map((id) => dashboards.find((d) => d.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header / Actions */}
      <div className="flex flex-col gap-4 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Charts</h1>
          <div className="flex items-center gap-2">
            <Link href="chart-builder">
              <Button size="sm">
                <PlusIcon className="mr-2 h-4 w-4" />
                Chart
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input placeholder="Type a value" className="w-[300px] pl-9" />
          </div>
          {/* Filter Dropdowns */}
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            {["Type", "Dataset", "Owner", "Dashboard", "Favorite", "Certified", "Modified by"].map(
              (filter) => (
                <Button key={filter} variant="outline" className="whitespace-nowrap text-gray-500" size="sm">
                  {filter} <span className="ml-2 text-xs">▼</span>
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto bg-gray-50 pt-6">
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="border-b border-gray-200 px-6 py-3">Name</th>
                <th className="border-b border-gray-200 px-6 py-3">Type</th>
                <th className="border-b border-gray-200 px-6 py-3">Dataset</th>
                <th className="border-b border-gray-200 px-6 py-3">On dashboards</th>
                {/* Hiding owners to save space if needed, mirroring Superset compact view */}
                <th className="border-b border-gray-200 px-6 py-3">Last Modified</th>
                <th className="border-b border-gray-200 px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {charts.map((chart) => (
                <tr key={chart.id} className="group transition-colors hover:bg-gray-50">
                  <td className="text-brand-dark px-6 py-4 font-medium">
                    <Link href={`/environments/${environmentId}/analysis/chart-builder?chartId=${chart.id}`}>
                      <span className="cursor-pointer hover:underline">{chart.name}</span>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-900">
                    {chart.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </td>
                  <td className="text-brand-dark cursor-pointer px-6 py-4 hover:underline">
                    {chart.dataset}
                  </td>
                  <td className="text-brand-dark px-6 py-4">
                    {getDashboardNames(chart.dashboardIds) || "-"}
                  </td>
                  <td className="px-6 py-4">
                    {formatDistanceToNow(new Date(chart.lastModified), { addSuffix: true })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-100">
                        <TrashIcon className="h-4 w-4 text-gray-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-100">
                        <Edit2Icon className="h-4 w-4 text-gray-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {charts.length === 0 && <div className="p-12 text-center text-gray-500">No charts found.</div>}
        </div>
      </div>
    </div>
  );
}
