"use client";

import { CodeIcon, DatabaseIcon, EyeOffIcon, PlusIcon, SaveIcon, SettingsIcon } from "lucide-react";
import { AnalyticsResponse } from "@/app/api/analytics/_lib/types";
import { Button } from "@/modules/ui/components/button";
import { ChartRenderer } from "./ChartRenderer";
import { DataViewer } from "./DataViewer";
import { QueryViewer } from "./QueryViewer";

interface ChartPreviewProps {
  chartData: AnalyticsResponse;
  configuredChartType: string | null;
  showQuery: boolean;
  showData: boolean;
  isSaving: boolean;
  onToggleQuery: () => void;
  onToggleData: () => void;
  onConfigure: () => void;
  onSave: () => void;
  onAddToDashboard: () => void;
}

export function ChartPreview({
  chartData,
  configuredChartType,
  showQuery,
  showData,
  isSaving,
  onToggleQuery,
  onToggleData,
  onConfigure,
  onSave,
  onAddToDashboard,
}: ChartPreviewProps) {
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Chart Preview</h3>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleQuery}
              className="text-gray-600 hover:text-gray-900">
              {showQuery ? (
                <>
                  <EyeOffIcon className="mr-2 h-4 w-4" />
                  Hide Query
                </>
              ) : (
                <>
                  <CodeIcon className="mr-2 h-4 w-4" />
                  View Query
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleData}
              className="text-gray-600 hover:text-gray-900">
              {showData ? (
                <>
                  <EyeOffIcon className="mr-2 h-4 w-4" />
                  Hide Data
                </>
              ) : (
                <>
                  <DatabaseIcon className="mr-2 h-4 w-4" />
                  View Data
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onConfigure}
              className="text-gray-600 hover:text-gray-900">
              <SettingsIcon className="mr-2 h-4 w-4" />
              Configure
            </Button>
            <Button variant="outline" size="sm" onClick={onAddToDashboard} disabled={isSaving}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add to Dashboard
            </Button>
            <Button variant="default" size="sm" onClick={onSave} disabled={isSaving}>
              <SaveIcon className="mr-2 h-4 w-4" />
              Save Chart
            </Button>
          </div>
        </div>
        <ChartRenderer chartType={configuredChartType || chartData.chartType} data={chartData.data || []} />

        <QueryViewer query={chartData.query} isOpen={showQuery} onOpenChange={onToggleQuery} />
        <DataViewer data={chartData.data || []} isOpen={showData} onOpenChange={onToggleData} />
      </div>
    </div>
  );
}
