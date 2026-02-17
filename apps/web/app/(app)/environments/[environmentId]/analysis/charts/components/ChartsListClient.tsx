"use client";

import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";
import {
  ActivityIcon,
  AreaChartIcon,
  BarChart3Icon,
  LineChartIcon,
  MapIcon,
  PieChartIcon,
  ScatterChart,
  TableIcon,
} from "lucide-react";
import { TChart } from "../../types/analysis";
import { ChartDropdownMenu } from "./ChartDropdownMenu";
import { CreateChartDialog } from "./CreateChartDialog";

interface ChartsListClientProps {
  charts: TChart[];
  dashboards: any[];
  environmentId: string;
}

const CHART_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  area: AreaChartIcon,
  bar: BarChart3Icon,
  line: LineChartIcon,
  pie: PieChartIcon,
  table: TableIcon,
  big_number: ActivityIcon,
  big_number_total: ActivityIcon,
  scatter: ScatterChart,
  map: MapIcon,
};

export function ChartsListClient({ charts: initialCharts, dashboards: _dashboards, environmentId }: ChartsListClientProps) {
  const [charts, setCharts] = useState(initialCharts);
  const [editingChartId, setEditingChartId] = useState<string | undefined>(undefined);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const filteredCharts = charts;

  const deleteChart = (chartId: string) => {
    setCharts(charts.filter((c) => c.id !== chartId));
  };

  const getChartIcon = (type: string) => {
    const IconComponent = CHART_TYPE_ICONS[type] || BarChart3Icon;
    return <IconComponent className="h-5 w-5" />;
  };

  const handleChartClick = (chartId: string) => {
    setEditingChartId(chartId);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    // Refresh charts list if needed
    setIsEditDialogOpen(false);
    setEditingChartId(undefined);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid h-12 grid-cols-7 content-center border-b text-left text-sm font-semibold text-slate-900">
        <div className="col-span-3 pl-6">Title</div>
        <div className="col-span-1 hidden text-center sm:block">Created By</div>
        <div className="col-span-1 hidden text-center sm:block">Created</div>
        <div className="col-span-1 hidden text-center sm:block">Updated</div>
        <div className="col-span-1"></div>
      </div>
      {filteredCharts.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No charts found.</p>
      ) : (
        <>
          {filteredCharts.map((chart) => (
            <div
              key={chart.id}
              onClick={() => handleChartClick(chart.id)}
              className="grid h-12 w-full cursor-pointer grid-cols-7 content-center p-2 text-left transition-colors ease-in-out hover:bg-slate-100">
              <div className="col-span-3 flex items-center pl-6 text-sm">
                <div className="flex items-center gap-4">
                  <div className="ph-no-capture w-8 flex-shrink-0 text-slate-500">
                    {getChartIcon(chart.type)}
                  </div>
                  <div className="flex flex-col">
                    <div className="ph-no-capture font-medium text-slate-900">{chart.name}</div>
                  </div>
                </div>
              </div>
              <div className="col-span-1 my-auto hidden text-center text-sm whitespace-nowrap text-slate-500 sm:block">
                <div className="ph-no-capture text-slate-900">{chart.createdByName || "-"}</div>
              </div>
              <div className="col-span-1 my-auto hidden text-center text-sm whitespace-normal text-slate-500 sm:block">
                <div className="ph-no-capture text-slate-900">
                  {format(new Date(chart.createdAt), "do 'of' MMMM, yyyy")}
                </div>
              </div>
              <div className="col-span-1 my-auto hidden text-center text-sm text-slate-500 sm:block">
                <div className="ph-no-capture text-slate-900">
                  {formatDistanceToNow(new Date(chart.updatedAt), {
                    addSuffix: true,
                  }).replace("about", "")}
                </div>
              </div>
              <div
                className="col-span-1 my-auto flex items-center justify-end pr-6"
                onClick={(e) => e.stopPropagation()}>
                <ChartDropdownMenu
                  environmentId={environmentId}
                  chart={chart}
                  deleteChart={deleteChart}
                  onEdit={() => {
                    setEditingChartId(chart.id);
                    setIsEditDialogOpen(true);
                  }}
                />
              </div>
            </div>
          ))}
        </>
      )}
      <CreateChartDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        environmentId={environmentId}
        chartId={editingChartId}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
