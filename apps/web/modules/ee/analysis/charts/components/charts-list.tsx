"use client";

import { format, formatDistanceToNow } from "date-fns";
import { BarChart3Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChartDropdownMenu } from "@/modules/ee/analysis/charts/components/chart-dropdown-menu";
import { CreateChartDialog } from "@/modules/ee/analysis/charts/components/create-chart-dialog";
import { CHART_TYPE_ICONS } from "@/modules/ee/analysis/charts/lib/chart-types";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";

interface ChartsListProps {
  charts: TChartWithCreator[];
  environmentId: string;
}

export function ChartsList({ charts, environmentId }: Readonly<ChartsListProps>) {
  const [editingChartId, setEditingChartId] = useState<string | undefined>(undefined);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { t } = useTranslation();
  const filteredCharts = charts;

  const getChartIcon = (type: string) => {
    const IconComponent = CHART_TYPE_ICONS[type] || BarChart3Icon;
    return <IconComponent className="h-5 w-5" />;
  };

  const handleChartClick = (chartId: string) => {
    setEditingChartId(chartId);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    setEditingChartId(undefined);
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, chartId: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleChartClick(chartId);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid h-12 grid-cols-7 content-center border-b text-left text-sm font-semibold text-slate-900">
        <div className="col-span-3 pl-6">{t("common.title")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.created_by")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.created_at")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.updated_at")}</div>
        <div className="col-span-1" />
      </div>
      {filteredCharts.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          {t("environments.analysis.charts.no_charts_found")}
        </p>
      ) : (
        <>
          {filteredCharts.map((chart) => (
            // Cannot use native <button>; row contains dropdown trigger (nested interactive invalid)
            // eslint-disable-next-line jsx-a11y/prefer-tag-over-role, jsx-a11y/no-static-element-interactions
            <div
              key={chart.id}
              role="button"
              tabIndex={0}
              onClick={() => handleChartClick(chart.id)}
              onKeyDown={(e) => handleRowKeyDown(e, chart.id)}
              aria-label={t("environments.analysis.charts.open_chart", { name: chart.name })}
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
              <div className="col-span-1 my-auto hidden whitespace-nowrap text-center text-sm text-slate-500 sm:block">
                <div className="ph-no-capture text-slate-900">{chart.creator?.name ?? "-"}</div>
              </div>
              <div className="col-span-1 my-auto hidden whitespace-normal text-center text-sm text-slate-500 sm:block">
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
              <div className="col-span-1 my-auto flex items-center justify-end pr-6">
                <ChartDropdownMenu
                  environmentId={environmentId}
                  chart={chart}
                  onEdit={(chartId) => {
                    setEditingChartId(chartId);
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
