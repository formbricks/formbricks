"use client";

import { cn } from "@/lib/cn";
import { CHART_TYPES } from "../lib/chart-types";

interface ManualChartBuilderProps {
  selectedChartType: string;
  onChartTypeSelect: (type: string) => void;
}

// Filter out table, map, and scatter charts
const AVAILABLE_CHART_TYPES = CHART_TYPES.filter(
  (type) => !["table", "map", "scatter"].includes(type.id)
);

export function ManualChartBuilder({
  selectedChartType,
  onChartTypeSelect,
}: Omit<ManualChartBuilderProps, "onCreate">) {
  return (
    <div className="space-y-4">
      <h2 className="font-medium text-gray-900">Choose chart type</h2>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {AVAILABLE_CHART_TYPES.map((chart) => {
            const isSelected = selectedChartType === chart.id;
            return (
              <button
                key={chart.id}
                type="button"
                onClick={() => onChartTypeSelect(chart.id)}
                className={cn(
                  "focus:ring-brand-dark rounded-md border p-4 text-center transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2",
                  isSelected
                    ? "border-brand-dark ring-brand-dark bg-brand-dark/5 ring-1"
                    : "border-gray-200 hover:border-gray-300"
                )}>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded bg-gray-100">
                  <chart.icon className="h-6 w-6 text-gray-600" strokeWidth={1.5} />
                </div>
                <span className="text-xs font-medium text-gray-700">{chart.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
