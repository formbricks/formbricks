"use client";

import { useCallback } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  type TAppDashboard,
  duplicateChart,
  getChartApiErrorMessage,
  removeDashboardWidget,
  restoreDashboardWidget,
} from "@/modules/ee/analysis/lib/api-client";
import type { TDashboardChartWidget, TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { findNextOpenSlot } from "../lib/widget-placement";

/**
 * A chart's menu outside edit mode writes to the server at once: duplicate, remove (with undo). Each is a
 * view write, so entering edit mode waits for it. In edit mode, remove only changes the draft.
 */
export const useDashboardViewModeWrites = ({
  dashboard,
  isEditing,
  widgets,
  handleRemoveWidget,
  beginViewWrite,
  endViewWrite,
  refreshDashboard,
}: Readonly<{
  dashboard: TAppDashboard;
  isEditing: boolean;
  /** The draft's widgets while editing, the dashboard's otherwise. */
  widgets: TDashboardWidget[];
  /** Removes a widget from the edit's draft. */
  handleRemoveWidget: (widgetId: string) => void;
  beginViewWrite: () => void;
  endViewWrite: () => void;
  refreshDashboard: () => Promise<void>;
}>) => {
  const { t } = useTranslation();

  const handleDuplicateWidget = useCallback(
    async (widget: TDashboardChartWidget) => {
      // The copy keeps the original's size and takes the first gap it fits on the same page, so it never
      // lands on top of the original. A slot below the grid's last row is refused like any taken one, and
      // the client retries without a layout — the server then answers 409 with the reason, if it has no room.
      const slot = findNextOpenSlot(
        dashboard.widgets
          .filter((current) => current.pageId === widget.pageId)
          .map((current) => current.layout),
        widget.layout
      );
      beginViewWrite();
      try {
        await duplicateChart(widget.chartId, {
          dashboardId: dashboard.id,
          pageId: widget.pageId,
          layout: { ...widget.layout, ...slot },
        });
        toast.success(t("workspace.analysis.dashboards.chart_duplicated"));
        await refreshDashboard();
      } catch (error) {
        toast.error(
          getChartApiErrorMessage(error, t("workspace.analysis.dashboards.chart_duplicate_failed"))
        );
      } finally {
        endViewWrite();
      }
    },
    [beginViewWrite, dashboard.id, dashboard.widgets, endViewWrite, refreshDashboard, t]
  );

  const handleUndoRemoveWidget = useCallback(
    async (snapshot: TDashboardChartWidget) => {
      beginViewWrite();
      try {
        await restoreDashboardWidget(dashboard.id, snapshot);
        toast.success(t("workspace.analysis.dashboards.chart_restored"));
        await refreshDashboard();
      } catch (error) {
        toast.error(getChartApiErrorMessage(error, t("workspace.analysis.dashboards.chart_restore_failed")));
      } finally {
        endViewWrite();
      }
    },
    [beginViewWrite, dashboard.id, endViewWrite, refreshDashboard, t]
  );

  const handleRemoveWidgetFromMenu = useCallback(
    async (widgetId: string) => {
      // In edit mode removal stays in draft state until save — no API call.
      if (isEditing) {
        handleRemoveWidget(widgetId);
        return;
      }

      const snapshot = widgets.find((w) => w.id === widgetId);
      if (snapshot?.kind !== "chart") return;

      beginViewWrite();
      try {
        await removeDashboardWidget(dashboard.id, widgetId);

        toast.success(
          (toastInstance) => (
            <div className="flex items-center gap-3">
              <span>{t("workspace.analysis.dashboards.chart_removed")}</span>
              <button
                type="button"
                className="text-sm font-medium text-black underline hover:text-slate-700"
                onClick={() => {
                  toast.dismiss(toastInstance.id);
                  void handleUndoRemoveWidget(snapshot);
                }}>
                {t("common.undo")}
              </button>
            </div>
          ),
          { duration: 6000 }
        );
        await refreshDashboard();
      } catch (error) {
        toast.error(getChartApiErrorMessage(error, t("workspace.analysis.dashboards.chart_remove_failed")));
      } finally {
        endViewWrite();
      }
    },
    [
      beginViewWrite,
      widgets,
      dashboard.id,
      endViewWrite,
      handleRemoveWidget,
      handleUndoRemoveWidget,
      isEditing,
      refreshDashboard,
      t,
    ]
  );

  return { handleDuplicateWidget, handleRemoveWidgetFromMenu };
};
