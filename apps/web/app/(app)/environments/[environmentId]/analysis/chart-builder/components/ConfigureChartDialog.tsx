"use client";

import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { CHART_TYPES } from "../lib/chart-types";

interface ConfigureChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentChartType: string;
  configuredChartType: string | null;
  onChartTypeSelect: (type: string) => void;
  onReset: () => void;
}

export function ConfigureChartDialog({
  open,
  onOpenChange,
  currentChartType,
  configuredChartType,
  onChartTypeSelect,
  onReset,
}: ConfigureChartDialogProps) {
  const availableTypes = CHART_TYPES.filter((type) =>
    ["bar", "line", "area", "pie", "big_number"].includes(type.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure Chart</DialogTitle>
          <DialogDescription>
            Modify the chart type and other settings for this visualization.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-6">
            <div>
              <h4 className="mb-3 text-sm font-medium text-gray-900">Chart Type</h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {availableTypes.map((chart) => {
                  const isSelected = (configuredChartType || currentChartType) === chart.id;
                  return (
                    <button
                      key={chart.id}
                      type="button"
                      onClick={() => onChartTypeSelect(chart.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-lg border p-4 transition-all hover:bg-gray-50",
                        isSelected
                          ? "border-brand-dark bg-brand-dark/5 ring-brand-dark ring-2"
                          : "border-gray-200"
                      )}>
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100">
                        <chart.icon className="h-5 w-5 text-gray-600" strokeWidth={1.5} />
                      </div>
                      <span className="text-xs font-medium text-gray-700">{chart.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onReset} className="text-xs">
                  Reset to AI suggestion
                </Button>
                {configuredChartType && (
                  <span className="text-xs text-gray-500">
                    Original: {CHART_TYPES.find((t) => t.id === currentChartType)?.name || currentChartType}
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => onOpenChange(false)}>Apply Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
