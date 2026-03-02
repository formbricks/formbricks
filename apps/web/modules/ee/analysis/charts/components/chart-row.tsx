"use client";

import { BarChart3Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { convertDateString, timeSinceDate } from "@/lib/time";
import { ChartDropdownMenu } from "@/modules/ee/analysis/charts/components/chart-dropdown-menu";
import { CreateChartDialog } from "@/modules/ee/analysis/charts/components/create-chart-dialog";
import { CHART_TYPE_ICONS } from "@/modules/ee/analysis/charts/lib/chart-types";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";

interface ChartRowProps {
  chart: TChartWithCreator;
  environmentId: string;
  isReadOnly: boolean;
}

export function ChartRow({ chart, environmentId, isReadOnly }: Readonly<ChartRowProps>) {
  const { t } = useTranslation();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const IconComponent = CHART_TYPE_ICONS[chart.type as keyof typeof CHART_TYPE_ICONS] ?? BarChart3Icon;

  const handleChartClick = () => {
    if (!isReadOnly) {
      setIsEditDialogOpen(true);
    }
  };

  const handleRowKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleChartClick();
    }
  };

  return (
    <>
      {/* Cannot use native <button>; row contains dropdown trigger (nested interactive invalid) */}
      {/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role, jsx-a11y/no-static-element-interactions */}
      <div
        role={isReadOnly ? undefined : "button"}
        tabIndex={isReadOnly ? undefined : 0}
        onClick={isReadOnly ? undefined : handleChartClick}
        onKeyDown={isReadOnly ? undefined : handleRowKeyDown}
        aria-label={
          isReadOnly ? undefined : t("environments.analysis.charts.open_chart", { name: chart.name })
        }
        className={`grid h-12 w-full grid-cols-7 content-center p-2 text-left transition-colors ease-in-out hover:bg-slate-100 ${isReadOnly ? "" : "cursor-pointer"}`}>
        <div className="col-span-6 grid grid-cols-6 content-center">
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
        <div // NOSONAR - stopPropagation wrapper to prevent row click when interacting with dropdown
          className="col-span-1 my-auto flex items-center justify-end pr-6"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}>
          {!isReadOnly && (
            <ChartDropdownMenu
              environmentId={environmentId}
              chart={chart}
              onEdit={() => setIsEditDialogOpen(true)}
            />
          )}
        </div>
      </div>
      {!isReadOnly && (
        <CreateChartDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          environmentId={environmentId}
          chartId={chart.id}
          initialChart={chart}
          onSuccess={() => setIsEditDialogOpen(false)}
        />
      )}
    </>
  );
}
