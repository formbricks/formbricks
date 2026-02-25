"use client";

import { BarChart3Icon } from "lucide-react";
import { convertDateString, timeSinceDate } from "@/lib/time";
import { ChartDropdownMenu } from "@/modules/ee/analysis/charts/components/chart-dropdown-menu";
import { CHART_TYPE_ICONS } from "@/modules/ee/analysis/charts/lib/chart-types";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";

interface ChartRowProps {
  chart: TChartWithCreator;
  environmentId: string;
  isReadOnly: boolean;
}

export function ChartRow({ chart, environmentId, isReadOnly }: Readonly<ChartRowProps>) {
  const IconComponent = CHART_TYPE_ICONS[chart.type as keyof typeof CHART_TYPE_ICONS] ?? BarChart3Icon;

  return (
    <div className="grid h-12 w-full grid-cols-7 content-center text-left transition-colors ease-in-out hover:bg-slate-100">
      <div className="col-span-6 grid grid-cols-6 content-center p-2">
        <div className="col-span-3 flex items-center pl-6 text-sm">
          <div className="flex items-center gap-4">
            <div className="ph-no-capture w-8 flex-shrink-0 text-slate-500">
              <IconComponent className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <div className="ph-no-capture font-medium text-slate-900">{chart.name}</div>
            </div>
          </div>
        </div>
        <div className="col-span-1 my-auto hidden whitespace-nowrap text-center text-sm text-slate-500 sm:block">
          <div className="ph-no-capture text-slate-900">{chart.creator?.name ?? "-"}</div>
        </div>
        <div className="col-span-1 my-auto hidden whitespace-normal text-center text-sm text-slate-500 sm:block">
          <div className="ph-no-capture text-slate-900">
            {convertDateString(chart.createdAt.toISOString())}
          </div>
        </div>
        <div className="col-span-1 my-auto hidden text-center text-sm text-slate-500 sm:block">
          <div className="ph-no-capture text-slate-900">{timeSinceDate(new Date(chart.updatedAt))}</div>
        </div>
      </div>
      <div className="col-span-1 my-auto flex items-center justify-end pr-6">
        {!isReadOnly && <ChartDropdownMenu environmentId={environmentId} chart={chart} />}
      </div>
    </div>
  );
}
