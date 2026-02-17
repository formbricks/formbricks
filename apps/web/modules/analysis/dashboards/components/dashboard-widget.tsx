"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { executeQueryAction } from "../actions";
import { TDashboardWidget } from "../types/analysis";
import { ChartRenderer } from "./chart-builder/chart-renderer";

interface DashboardWidgetProps {
  widget: TDashboardWidget;
  environmentId: string;
}

export function DashboardWidget({ widget, environmentId }: DashboardWidgetProps) {
  const [chartData, setChartData] = useState<Record<string, unknown>[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (widget.type === "chart" && widget.chart) {
      setIsLoading(true);
      setError(null);
      executeQueryAction({
        environmentId,
        query: widget.chart.query,
      })
        .then((result) => {
          if (result?.serverError || result?.data?.error) {
            setError(result.serverError || result.data?.error || "Failed to load chart data");
            setChartData(null);
          } else if (result?.data?.data) {
            const data = Array.isArray(result.data.data) ? result.data.data : [];
            setChartData(data);
            setError(null);
          } else {
            setError("No data returned");
            setChartData(null);
          }
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Failed to load chart data";
          setError(message);
          setChartData(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [widget, environmentId]);

  const renderContent = () => {
    if (widget.type === "chart") {
      if (!widget.chart) {
        return <div className="flex h-full items-center justify-center text-gray-500">Chart not found</div>;
      }

      if (isLoading) {
        return (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner />
          </div>
        );
      }

      if (error) {
        return (
          <div className="flex h-full w-full flex-col items-start justify-center rounded-md border border-red-100 bg-red-50 p-4">
            <div className="mb-1 flex items-center gap-2 font-semibold text-red-700">
              <div className="rounded-full bg-red-600 p-0.5">
                <span className="block h-3 w-3 text-center text-[10px] leading-3 text-white">✕</span>
              </div>
              Data error
            </div>
            <p className="text-xs text-red-600">{error}</p>
          </div>
        );
      }

      if (!chartData || chartData.length === 0) {
        return <div className="flex h-full items-center justify-center text-gray-500">No data available</div>;
      }

      return <ChartRenderer chartType={widget.chart.type} data={chartData} />;
    }

    if (widget.type === "markdown") {
      return (
        <div className="prose prose-sm max-w-none">
          <p className="text-gray-500">Markdown widget placeholder</p>
        </div>
      );
    }

    if (widget.type === "header") {
      return (
        <div className="flex h-full items-center">
          <h2 className="text-2xl font-semibold text-gray-900">{widget.title || "Header"}</h2>
        </div>
      );
    }

    if (widget.type === "divider") {
      return <div className="h-full w-full border-t border-gray-200" />;
    }

    return null;
  };

  return (
    <div className="flex h-full flex-col rounded-sm border border-gray-200 bg-white shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
        <h3 className="text-sm font-semibold text-gray-800">
          {widget.title || widget.chart?.name || "Widget"}
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
              <MoreHorizontalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Force refresh</DropdownMenuItem>
            <DropdownMenuItem>View as table</DropdownMenuItem>
            <DropdownMenuItem>Maximize</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="relative min-h-[300px] flex-1 p-4">{renderContent()}</div>
    </div>
  );
}
