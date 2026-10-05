"use client";

import { useTranslation } from "react-i18next";
import type { TChartConfig, TChartQuery } from "@formbricks/types/analysis";
import {
  AdvancedChartBuilder,
  type ChartQueryState,
} from "@/modules/ee/analysis/charts/components/advanced-chart-builder";
import { ChartDisplaySettings } from "@/modules/ee/analysis/charts/components/chart-display-settings";
import { ChartNameField } from "@/modules/ee/analysis/charts/components/chart-name-field";
import { ChartPreview } from "@/modules/ee/analysis/charts/components/chart-preview";
import { ChartTypeSwitch } from "@/modules/ee/analysis/charts/components/chart-type-switch";
import { hasChartDisplaySettings } from "@/modules/ee/analysis/charts/lib/chart-display";
import type { AnalyticsResponse, TChartType } from "@/modules/ee/analysis/types/analysis";

interface ChartBuilderBodyProps {
  formId: string;
  workspaceId: string;
  feedbackDirectoryId: string;
  chartType: TChartType;
  chartData: AnalyticsResponse | null;
  chartConfig: TChartConfig;
  onChartConfigChange: (config: TChartConfig) => void;
  initialQuery?: TChartQuery;
  chartName: string;
  onChartNameChange: (name: string) => void;
  onSave: () => void;
  onChartTypeSelect: (type: TChartType) => void;
  onChartGenerated: (data: AnalyticsResponse) => void;
  onQueryStateChange: (state: ChartQueryState) => void;
  queryState: ChartQueryState;
  isLoadingChart: boolean;
  chartLoadError: string | null;
}

/**
 * Two regions that each mean one thing: a rail of everything you set, and a stage showing what that
 * produces. Only the rail scrolls, so the chart, its type and its display settings are all on screen
 * at once however long the configuration gets.
 */
export function ChartBuilderBody({
  formId,
  workspaceId,
  feedbackDirectoryId,
  chartType,
  chartData,
  chartConfig,
  onChartConfigChange,
  initialQuery,
  chartName,
  onChartNameChange,
  onSave,
  onChartTypeSelect,
  onChartGenerated,
  onQueryStateChange,
  queryState,
  isLoadingChart,
  chartLoadError,
}: Readonly<ChartBuilderBodyProps>) {
  const { t } = useTranslation();
  const showsDisplaySettings = Boolean(chartData) && hasChartDisplaySettings(chartData?.chartType);
  // A preset hands over a query with no rows yet: the builder runs it, and until then the preview
  // spins instead of flashing "no data returned".
  const isAwaitingFirstRun = Boolean(chartData && !chartData.data && !chartData.error && !queryState.error);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto px-1 pb-1 lg:pr-3">
        <ChartNameField formId={formId} value={chartName} onChange={onChartNameChange} onSubmit={onSave} />

        <AdvancedChartBuilder
          workspaceId={workspaceId}
          chartType={chartType}
          initialQuery={chartData?.query ?? initialQuery}
          runInitialQuery={isAwaitingFirstRun}
          onChartGenerated={onChartGenerated}
          onQueryStateChange={onQueryStateChange}
          feedbackDirectoryId={feedbackDirectoryId}
        />
      </div>

      <ChartPreview
        className="min-h-0 min-w-0"
        chartData={chartData}
        config={chartConfig}
        isLoading={isLoadingChart || queryState.isLoading || isAwaitingFirstRun}
        error={chartLoadError ?? queryState.error}
        emptyMessage={
          chartType === "matrix"
            ? t("workspace.analysis.charts.matrix_empty_prompt")
            : t("workspace.analysis.charts.advanced_chart_builder_config_prompt")
        }
        typeControl={<ChartTypeSwitch selectedChartType={chartType} onChartTypeSelect={onChartTypeSelect} />}
        displaySettings={
          showsDisplaySettings ? (
            <ChartDisplaySettings
              chartType={chartData?.chartType}
              config={chartConfig}
              onChange={onChartConfigChange}
            />
          ) : undefined
        }
      />
    </div>
  );
}
