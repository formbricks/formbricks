"use client";

import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { CHART_TYPES } from "../lib/chart-types";

interface ManualChartBuilderProps {
  selectedChartType: string;
  onChartTypeSelect: (type: string) => void;
  onCreate: () => void;
}

export function ManualChartBuilder({ selectedChartType, onChartTypeSelect, onCreate }: ManualChartBuilderProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChartTypes = CHART_TYPES.filter((type) =>
    type.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
            1
          </span>
          <h2 className="font-medium text-gray-900">Choose chart type</h2>
        </div>

        <div className="ml-8 rounded-lg border border-gray-200 bg-white p-4">
          <div className="relative mb-4">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search all charts"
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filteredChartTypes.map((chart) => {
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

      <div className="flex justify-end pt-2">
        <Button disabled={!selectedChartType} variant="outline" onClick={onCreate}>
          Create Manually
        </Button>
      </div>
    </div>
  );
}
