"use client";

import { BarChart, DatabaseIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChartRenderer } from "@/modules/ee/analysis/charts/components/chart-renderer";
import { DataViewer } from "@/modules/ee/analysis/charts/components/data-viewer";
import { AnalyticsResponse } from "@/modules/ee/analysis/types/analysis";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";

interface ChartPreviewProps {
  chartData: AnalyticsResponse | null;
  isLoading?: boolean;
}

export function ChartPreview({ chartData, isLoading = false }: Readonly<ChartPreviewProps>) {
  const [activeTab, setActiveTab] = useState<"chart" | "data">("chart");
  const { t } = useTranslation();

  const data = chartData?.data ?? [];

  const handleTabChange = (value: string) => {
    if (value === "chart" || value === "data") {
      setActiveTab(value);
    }
  };

  const renderContent = () => {
    if (isLoading || !chartData) {
      return (
        <div className="flex h-48 items-center justify-center">
          <LoadingSpinner />
        </div>
      );
    }

    if (chartData.error) {
      return (
        <div className="flex h-48 items-center justify-center text-sm text-red-600">{chartData.error}</div>
      );
    }

    return (
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="mb-4 flex justify-end">
          <TabsList>
            <TabsTrigger value="chart" icon={<BarChart className="h-4 w-4" />}>
              {t("environments.analysis.charts.chart")}
            </TabsTrigger>
            <TabsTrigger value="data" icon={<DatabaseIcon className="h-4 w-4" />}>
              {t("environments.analysis.charts.chart_data_tab")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chart" className="mt-0">
          <ChartRenderer chartType={chartData.chartType} data={data} />
        </TabsContent>

        <TabsContent value="data" className="mt-0">
          <DataViewer data={data} />
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 font-semibold text-gray-900">{t("environments.analysis.charts.chart_preview")}</h3>
      {renderContent()}
    </div>
  );
}
