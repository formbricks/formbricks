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
import { AiIcon } from "@/modules/ui/components/ai";
import { Button } from "@/modules/ui/components/button";

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
  /** Rendered in the empty stage when this workspace can generate a chart with AI. */
  onRequestAI?: () => void;
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
  onRequestAI,
}: Readonly<ChartBuilderBodyProps>) {
  const { t } = useTranslation();
  const showsDisplaySettings = Boolean(chartData) && hasChartDisplaySettings(chartData?.chartType);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto px-1 pb-1 lg:pr-3">
        <ChartNameField formId={formId} value={chartName} onChange={onChartNameChange} onSubmit={onSave} />

        <AdvancedChartBuilder
          workspaceId={workspaceId}
          chartType={chartType}
          initialQuery={chartData?.query ?? initialQuery}
          onChartGenerated={onChartGenerated}
          onQueryStateChange={onQueryStateChange}
          feedbackDirectoryId={feedbackDirectoryId}
        />
      </div>

      <ChartPreview
        className="min-h-0 min-w-0"
        chartData={chartData}
        config={chartConfig}
        isLoading={isLoadingChart || queryState.isLoading}
        error={chartLoadError ?? queryState.error}
        emptyMessage={t("workspace.analysis.charts.advanced_chart_builder_config_prompt")}
        emptyAction={
          onRequestAI ? (
            <Button type="button" variant="ai-secondary" onClick={onRequestAI}>
              <AiIcon tone="inherit" />
              {t("workspace.analysis.charts.ai_create.generate_with_ai")}
            </Button>
          ) : undefined
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
