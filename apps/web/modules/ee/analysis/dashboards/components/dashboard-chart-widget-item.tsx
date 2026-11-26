"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { resolveChartType } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { DashboardWidget } from "@/modules/ee/analysis/dashboards/components/dashboard-widget";
import { DashboardWidgetData } from "@/modules/ee/analysis/dashboards/components/dashboard-widget-data";
import { isDraftId } from "@/modules/ee/analysis/dashboards/lib/dashboard-draft";
import type { TDashboardFilterState } from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-state";
import {
  DEFAULT_WIDGET_VIEW,
  type TWidgetView,
  readStoredWidgetView,
  writeStoredWidgetView,
} from "@/modules/ee/analysis/dashboards/lib/widget-view";
import type { TChartDateRangeInput } from "@/modules/ee/analysis/lib/api-client";
import type { TDashboardChartWidget } from "@/modules/ee/analysis/types/analysis";

const MemoizedWidgetContent = memo(function WidgetContent({
  widget,
  dateRange,
  filters,
  filterFieldLabel,
  view,
}: Readonly<{
  widget: TDashboardChartWidget;
  dateRange: TChartDateRangeInput | null;
  filters: readonly TDashboardFilterState[];
  filterFieldLabel: (field: string) => string;
  view: TWidgetView;
}>) {
  return (
    <DashboardWidgetData
      dashboardId={widget.dashboardId}
      chartId={widget.chartId}
      isUnsaved={isDraftId(widget.id)}
      dateRange={dateRange}
      filters={filters}
      filterFieldLabel={filterFieldLabel}
      // Through resolveChartType like every other read of a stored type, so a row still
      // carrying a retired value renders as its replacement instead of "not yet supported".
      chartType={resolveChartType(widget.chart.type)}
      config={widget.chart.config}
      view={view}
    />
  );
});

/** A chart on the dashboard grid: its frame and menu, its data, and the view (chart or table) this person chose. */
export const DashboardChartWidgetItem = memo(function WidgetItem({
  widget,
  isEditing,
  dateRange,
  filters,
  filterFieldLabel,
  onEdit,
  onDuplicate,
  onResize,
  onRemove,
}: Readonly<{
  widget: TDashboardChartWidget;
  isEditing: boolean;
  dateRange: TChartDateRangeInput | null;
  filters: readonly TDashboardFilterState[];
  filterFieldLabel: (field: string) => string;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onResize?: () => void;
  onRemove?: () => void;
}>) {
  const title = widget.chart?.name ?? "";
  // Server and first client render must agree, so start on the default and adopt the stored view
  // in an effect rather than reading localStorage during render.
  const [view, setView] = useState<TWidgetView>(DEFAULT_WIDGET_VIEW);

  useEffect(() => {
    setView(readStoredWidgetView(widget.id));
  }, [widget.id]);

  const handleViewChange = useCallback(
    (nextView: TWidgetView) => {
      setView(nextView);
      writeStoredWidgetView(widget.id, nextView);
    },
    [widget.id]
  );

  return (
    <DashboardWidget
      title={title}
      isEditing={isEditing}
      view={view}
      onViewChange={handleViewChange}
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      onResize={onResize}
      onRemove={onRemove}>
      <MemoizedWidgetContent
        widget={widget}
        dateRange={dateRange}
        filters={filters}
        filterFieldLabel={filterFieldLabel}
        view={view}
      />
    </DashboardWidget>
  );
});
