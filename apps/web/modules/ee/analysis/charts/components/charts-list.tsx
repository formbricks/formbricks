"use client";

import { BarChart3Icon } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { convertDateString, timeSinceDate } from "@/lib/time";
import { ChartDropdownMenu } from "@/modules/ee/analysis/charts/components/chart-dropdown-menu";
import { CHART_TYPE_ICONS } from "@/modules/ee/analysis/charts/lib/chart-types";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";

interface ChartsListProps {
  charts: TChartWithCreator[];
  environmentId: string;
  isReadOnly: boolean;
}

export function ChartsList({ charts, environmentId, isReadOnly }: Readonly<ChartsListProps>) {
  const { t } = useTranslation();

  const getChartIcon = (type: string) => {
    const IconComponent = CHART_TYPE_ICONS[type as keyof typeof CHART_TYPE_ICONS] ?? BarChart3Icon;
    return <IconComponent className="h-5 w-5" />;
  };

  const handleRowClick = () => {
    toast(t("environments.analysis.charts.action_coming_soon"));
  };

  const handleRowKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleRowClick();
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
      {charts.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          {t("environments.analysis.charts.no_charts_found")}
        </p>
      ) : (
        <>
          {charts.map((chart) => (
            // Cannot use native <button>; row contains dropdown trigger (nested interactive invalid)
            // eslint-disable-next-line jsx-a11y/prefer-tag-over-role, jsx-a11y/no-static-element-interactions
            <div
              key={chart.id}
              role="button"
              tabIndex={0}
              onClick={handleRowClick}
              onKeyDown={handleRowKeyDown}
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
                  {convertDateString(chart.createdAt.toISOString())}
                </div>
              </div>
              <div className="col-span-1 my-auto hidden text-center text-sm text-slate-500 sm:block">
                <div className="ph-no-capture text-slate-900">{timeSinceDate(new Date(chart.updatedAt))}</div>
              </div>
              {/* Stops click/key propagation so dropdown actions don't trigger the row handler */}
              <div // NOSONAR
                className="col-span-1 my-auto flex items-center justify-end pr-6"
                onClick={(e) => e.stopPropagation()}>
                {!isReadOnly && <ChartDropdownMenu environmentId={environmentId} chart={chart} />}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
