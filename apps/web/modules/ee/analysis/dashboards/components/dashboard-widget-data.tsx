import { ChartRenderer } from "./chart-builder/chart-renderer";

interface DashboardWidgetDataProps {
  dataPromise: Promise<{ data: Record<string, unknown>[] } | { error: string }>;
  chartType: string;
}

export async function DashboardWidgetData({ dataPromise, chartType }: DashboardWidgetDataProps) {
  const result = await dataPromise;

  if ("error" in result) {
    return (
      <div className="flex h-full w-full flex-col items-start justify-center rounded-md border border-red-100 bg-red-50 p-4">
        <div className="mb-1 flex items-center gap-2 font-semibold text-red-700">
          <div className="rounded-full bg-red-600 p-0.5">
            <span className="block h-3 w-3 text-center text-[10px] leading-3 text-white">&times;</span>
          </div>
          Data error
        </div>
        <p className="text-xs text-red-600">{result.error}</p>
      </div>
    );
  }

  if (!result.data || result.data.length === 0) {
    return <div className="flex h-full items-center justify-center text-gray-500">No data available</div>;
  }

  return <ChartRenderer chartType={chartType} data={result.data} />;
}
