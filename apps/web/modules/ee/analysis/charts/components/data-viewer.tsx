"use client";

import { DatabaseIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatCellValue } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { formatCubeColumnHeader } from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";

const MAX_DISPLAY_ROWS = 50;
interface DataViewerProps {
  data: TChartDataRow[];
}

export function DataViewer({ data }: Readonly<DataViewerProps>) {
  const { t } = useTranslation();
  if (!data || data.length === 0 || Object.keys(data[0]).length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-500">{t("environments.analysis.charts.no_data_available")}</p>
      </div>
    );
  }

  const columns = Object.keys(data[0]);
  const displayData = data.slice(0, MAX_DISPLAY_ROWS);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <DatabaseIcon className="h-4 w-4 text-gray-600" />
        <h4 className="text-sm font-semibold text-gray-900">
          {t("environments.analysis.charts.chart_data")}
        </h4>
      </div>
      <div className="max-h-64 overflow-auto rounded bg-white">
        <table className="w-full text-xs">
          <thead className="bg-gray-100">
            <tr>
              {columns.map((key) => (
                <th
                  key={key}
                  scope="col"
                  className="border-b border-gray-200 px-3 py-2 text-left font-semibold">
                  {formatCubeColumnHeader(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, index) => {
              const firstValue = Object.values(row)[0];
              const rowKey = firstValue ? String(firstValue) : `row-${index}`;
              return (
                <tr key={`data-row-${rowKey}-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
                  {Object.entries(row).map(([key, value]) => (
                    <td key={`cell-${key}-${rowKey}`} className="px-3 py-2">
                      {formatCellValue(value)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {data.length > MAX_DISPLAY_ROWS && (
          <div className="px-3 py-2 text-xs text-gray-500">
            {t("environments.analysis.charts.showing_first_n_of", {
              n: MAX_DISPLAY_ROWS,
              count: data.length,
            })}
          </div>
        )}
      </div>
    </div>
  );
}
