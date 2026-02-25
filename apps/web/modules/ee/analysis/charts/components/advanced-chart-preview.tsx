"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CodeIcon, DatabaseIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TChartQuery } from "@formbricks/types/analysis";
import { ChartRenderer } from "@/modules/ee/analysis/charts/components/chart-renderer";
import { DataViewer } from "@/modules/ee/analysis/charts/components/data-viewer";
import { QueryViewer } from "@/modules/ee/analysis/charts/components/query-viewer";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";
import { Button } from "@/modules/ui/components/button";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

interface AdvancedChartPreviewProps {
  error: string | null;
  isLoading: boolean;
  chartData: TChartDataRow[] | null;
  chartType: TChartType | "";
  query: TChartQuery | null;
}

export function AdvancedChartPreview({
  error,
  isLoading,
  chartData,
  chartType,
  query,
}: Readonly<AdvancedChartPreviewProps>) {
  const { t } = useTranslation();
  const [showQuery, setShowQuery] = useState(false);
  const [showData, setShowData] = useState(false);
  const hasData = chartData && chartData.length > 0 && !isLoading && chartType && query;
  const isEmpty = !chartData && !isLoading && !error;

  return (
    <div className="space-y-2">
      <h3 className="text-md font-semibold text-gray-900">
        {t("environments.analysis.charts.chart_preview")}
      </h3>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner />
        </div>
      )}

      {hasData && (
        <div className="space-y-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <ChartRenderer chartType={chartType} data={chartData} query={query} />
          </div>

          <QueryViewer
            query={query}
            isOpen={showQuery}
            onOpenChange={setShowQuery}
            trigger={
              <Collapsible.CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CodeIcon className="mr-2 h-4 w-4" />
                  {showQuery ? t("common.hide") : t("common.view")}{" "}
                  {t("environments.analysis.charts.query_label")}
                </Button>
              </Collapsible.CollapsibleTrigger>
            }
          />

          <Collapsible.Root open={showData} onOpenChange={setShowData}>
            <Collapsible.CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <DatabaseIcon className="mr-2 h-4 w-4" />
                {showData ? t("common.hide") : t("common.view")}{" "}
                {t("environments.analysis.charts.data_label")}
              </Button>
            </Collapsible.CollapsibleTrigger>
            <Collapsible.CollapsibleContent className="mt-2">
              <DataViewer data={chartData} />
            </Collapsible.CollapsibleContent>
          </Collapsible.Root>
        </div>
      )}

      {isEmpty && (
        <div className="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500">
          {t("environments.analysis.charts.advanced_chart_builder_config_prompt")}
        </div>
      )}
    </div>
  );
}
