"use client";

import { useTranslation } from "react-i18next";
import { getChartTypes } from "@/modules/ee/analysis/charts/lib/chart-types";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";

interface ChartTypeSelectorProps {
  selectedChartType: TChartType;
  onChartTypeSelect: (chartType: TChartType) => void;
}

export function ChartTypeSelector({
  selectedChartType,
  onChartTypeSelect,
}: Readonly<ChartTypeSelectorProps>) {
  const { t } = useTranslation();
  const chartTypes = getChartTypes(t);

  return (
    <div className="space-y-2">
      <h2 className="text-md font-semibold text-gray-900">
        {t("environments.analysis.charts.chart_builder_choose_chart_type")}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {chartTypes.map((chart) => {
          const isSelected = selectedChartType === chart.id;
          return (
            <button
              key={chart.id}
              type="button"
              onClick={() => onChartTypeSelect(chart.id)}
              className={`rounded-md border p-4 text-center transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isSelected
                  ? "border-brand-dark ring-brand-dark bg-brand-dark/5 ring-1"
                  : "border-gray-200 hover:border-gray-300"
              }`}>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded bg-gray-100">
                <chart.icon className="h-6 w-6 text-gray-600" strokeWidth={1.5} />
              </div>
              <span className="text-sm font-medium text-gray-700">{chart.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
