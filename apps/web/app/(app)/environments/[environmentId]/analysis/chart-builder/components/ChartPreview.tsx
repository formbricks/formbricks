"use client";

import { useState } from "react";
import { BarChart, DatabaseIcon } from "lucide-react";
import { AnalyticsResponse } from "@/app/api/analytics/_lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";
import { ChartRenderer } from "./ChartRenderer";
import { DataViewer } from "./DataViewer";

interface ChartPreviewProps {
  chartData: AnalyticsResponse;
}

export function ChartPreview({ chartData }: ChartPreviewProps) {
  const [activeTab, setActiveTab] = useState<"chart" | "data">("chart");

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Chart Preview</h3>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "chart" | "data")}>
          <div className="flex justify-end mb-4">
            <TabsList>
              <TabsTrigger value="chart" icon={<BarChart className="h-4 w-4" />}>
                Chart
              </TabsTrigger>
              <TabsTrigger value="data" icon={<DatabaseIcon className="h-4 w-4" />}>
                Data
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="chart" className="mt-0">
            <ChartRenderer chartType={chartData.chartType} data={chartData.data || []} />
          </TabsContent>

          <TabsContent value="data" className="mt-0">
            <DataViewer data={chartData.data || []} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
