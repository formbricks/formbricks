"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { DatabaseIcon } from "lucide-react";

interface DataViewerProps {
  data: Record<string, any>[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DataViewer({ data, isOpen, onOpenChange }: DataViewerProps) {
  if (!data || data.length === 0) {
    return null;
  }

  const columns = Object.keys(data[0]);
  const displayData = data.slice(0, 50);

  return (
    <Collapsible.Root open={isOpen} onOpenChange={onOpenChange}>
      <Collapsible.CollapsibleContent className="mt-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <DatabaseIcon className="h-4 w-4 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-900">Chart Data</h4>
          </div>
          <div className="max-h-64 overflow-auto rounded bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  {columns.map((key) => (
                    <th key={key} className="border-b border-gray-200 px-3 py-2 text-left font-semibold">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayData.map((row, index) => {
                  const rowKey = Object.values(row)[0] ? String(Object.values(row)[0]) : `row-${index}`;
                  return (
                    <tr
                      key={`data-row-${rowKey}-${index}`}
                      className="border-b border-gray-100 hover:bg-gray-50">
                      {Object.entries(row).map(([key, value]) => (
                        <td key={`cell-${key}-${rowKey}`} className="px-3 py-2">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {data.length > 50 && (
              <div className="px-3 py-2 text-xs text-gray-500">Showing first 50 of {data.length} rows</div>
            )}
          </div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
