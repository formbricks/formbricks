"use client";

import { useMemo } from "react";
import { ResponsiveGridLayout, useContainerWidth, verticalCompactor } from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { useTranslation } from "react-i18next";
import "react-resizable/css/styles.css";
import type { TDashboardImageContent, TDashboardTextContent } from "@formbricks/types/analysis";
import { DashboardChartWidgetItem } from "@/modules/ee/analysis/dashboards/components/dashboard-chart-widget-item";
import { DashboardLayoutBlock } from "@/modules/ee/analysis/dashboards/components/dashboard-layout-block";
import type { TImageUploadTicket } from "@/modules/ee/analysis/dashboards/lib/dashboard-draft";
import type { TDashboardFilterState } from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-state";
import {
  GRID_MARGIN,
  ROW_HEIGHT,
  isEmptyImageBlock,
  widgetsToLayout,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-grid-layout";
import { fitBlockHeights, isAutoHeightBlock } from "@/modules/ee/analysis/dashboards/lib/widget-blocks";
import type { TChartDateRangeInput } from "@/modules/ee/analysis/lib/api-client";
import type { TDashboardChartWidget, TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { EmptyState } from "@/modules/ui/components/empty-state";

interface DashboardGridProps {
  dashboardId: string;
  /** The selected page's widgets. */
  pageWidgets: TDashboardWidget[];
  neededRows: ReadonlyMap<string, number>;
  isEditing: boolean;
  isSaving: boolean;
  isReadOnly: boolean;
  /** A Dashboard Viewer whose attributes match nothing sees no charts at all. */
  isUnmatched: boolean;
  dateRange: TChartDateRangeInput | null;
  filters: readonly TDashboardFilterState[];
  filterFieldLabel: (field: string) => string;
  onInteractionEnd: (finalLayout: Layout) => void;
  onBlockContentChange: (widgetId: string, content: TDashboardImageContent | TDashboardTextContent) => void;
  onImageUploadStart: (widgetId: string) => TImageUploadTicket | null;
  onImageUploadEnd: (ticket: TImageUploadTicket, fileUrl: string | null) => void;
  onRemoveWidget: (widgetId: string) => void;
  onMeasure: (widgetId: string, px: number) => void;
  onEditChart: (chartId: string) => void;
  onDuplicateWidget: (widget: TDashboardChartWidget) => void;
  onRemoveWidgetFromMenu: (widgetId: string) => void;
  onEnterEditMode: () => void;
}

/** The selected page's widgets on the grid, or why there are none. */
export function DashboardGrid({
  dashboardId,
  pageWidgets,
  neededRows,
  isEditing,
  isSaving,
  isReadOnly,
  isUnmatched,
  dateRange,
  filters,
  filterFieldLabel,
  onInteractionEnd,
  onBlockContentChange,
  onImageUploadStart,
  onImageUploadEnd,
  onRemoveWidget,
  onMeasure,
  onEditChart,
  onDuplicateWidget,
  onRemoveWidgetFromMenu,
  onEnterEditMode,
}: Readonly<DashboardGridProps>) {
  const { t } = useTranslation();
  const { width, containerRef, mounted } = useContainerWidth();

  // An image block without a file is a placeholder for editors; viewers don't get an empty strip for it.
  const displayedWidgets = useMemo(
    () =>
      fitBlockHeights(
        isEditing ? pageWidgets : pageWidgets.filter((widget) => !isEmptyImageBlock(widget)),
        neededRows
      ),
    [pageWidgets, neededRows, isEditing]
  );
  const layout = useMemo(() => widgetsToLayout(displayedWidgets, neededRows), [displayedWidgets, neededRows]);
  // What is drawn decides it: outside edit mode an image block without a file is not drawn.
  const isPageEmpty = displayedWidgets.length === 0;

  const renderEmptyState = () => {
    if (isEditing) return <EmptyState text={t("workspace.analysis.dashboards.empty_page_message")} />;
    return (
      <EmptyState
        text={
          // Someone who can't edit the dashboard can't add charts to it either.
          isReadOnly
            ? t("workspace.analysis.dashboards.no_data_message_read_only")
            : t("workspace.analysis.dashboards.no_data_message")
        }
      />
    );
  };

  const renderWidget = (widget: TDashboardWidget) => {
    if (widget.kind !== "chart") {
      return (
        <DashboardLayoutBlock
          dashboardId={dashboardId}
          widget={widget}
          isEditing={isEditing}
          onContentChange={onBlockContentChange}
          onImageUploadStart={onImageUploadStart}
          onImageUploadEnd={onImageUploadEnd}
          onRemove={onRemoveWidget}
          onMeasure={isAutoHeightBlock(widget.kind) ? onMeasure : undefined}
        />
      );
    }
    return (
      <DashboardChartWidgetItem
        widget={widget}
        isEditing={isEditing}
        dateRange={dateRange}
        filters={filters}
        filterFieldLabel={filterFieldLabel}
        onEdit={isReadOnly ? undefined : () => onEditChart(widget.chartId)}
        // Duplicate is hidden in edit mode: it writes to the server at once, and the edit's save would then
        // be refused as stale. In edit mode, add the chart again from Add instead.
        onDuplicate={isReadOnly || isEditing ? undefined : () => onDuplicateWidget(widget)}
        onResize={isReadOnly ? undefined : onEnterEditMode}
        onRemove={isReadOnly ? undefined : () => onRemoveWidgetFromMenu(widget.id)}
      />
    );
  };

  return (
    <section>
      <div ref={containerRef} className="w-full">
        {isUnmatched && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <h2 className="text-base font-semibold text-slate-900">
              {t("workspace.analysis.dashboards.access_not_set_up_title")}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t("workspace.analysis.dashboards.access_not_set_up_description")}
            </p>
          </div>
        )}
        {!isUnmatched &&
          (isPageEmpty
            ? renderEmptyState()
            : mounted && (
                <ResponsiveGridLayout
                  width={width}
                  layouts={{ lg: layout }}
                  breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                  cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }}
                  rowHeight={ROW_HEIGHT}
                  margin={[GRID_MARGIN, GRID_MARGIN]}
                  // Keep 16px only between items; drop the default container padding (which mirrors
                  // margin) so the grid sits flush with the container's left/top edge, aligned with
                  // the date filter above instead of inset from it.
                  containerPadding={[0, 0]}
                  dragConfig={{
                    enabled: isEditing && !isSaving,
                    handle: ".rgl-drag-handle",
                    bounded: false,
                    threshold: 5,
                  }}
                  resizeConfig={{
                    enabled: isEditing && !isSaving,
                    handles: ["n", "s", "e", "w", "ne", "nw", "se", "sw"],
                  }}
                  compactor={verticalCompactor}
                  onDragStop={(finalLayout) => onInteractionEnd(finalLayout)}
                  onResizeStop={(finalLayout) => onInteractionEnd(finalLayout)}>
                  {displayedWidgets.map((widget) => (
                    <div key={widget.id}>{renderWidget(widget)}</div>
                  ))}
                </ResponsiveGridLayout>
              ))}
      </div>
    </section>
  );
}
