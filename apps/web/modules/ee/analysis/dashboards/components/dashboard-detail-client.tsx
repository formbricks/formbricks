"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ResponsiveGridLayout, useContainerWidth, verticalCompactor } from "react-grid-layout";
import type { Layout, LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import "react-resizable/css/styles.css";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { CreateChartDialog } from "@/modules/ee/analysis/charts/components/create-chart-dialog";
import { resolveChartType } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { ListLoadError } from "@/modules/ee/analysis/components/list-load-error";
import { DashboardControlBar } from "@/modules/ee/analysis/dashboards/components/dashboard-control-bar";
import { DashboardDateFilter } from "@/modules/ee/analysis/dashboards/components/dashboard-date-filter";
import { DashboardPageHeader } from "@/modules/ee/analysis/dashboards/components/dashboard-page-header";
import { DashboardWidget } from "@/modules/ee/analysis/dashboards/components/dashboard-widget";
import { DashboardWidgetData } from "@/modules/ee/analysis/dashboards/components/dashboard-widget-data";
import { DashboardWidgetSkeleton } from "@/modules/ee/analysis/dashboards/components/dashboard-widget-skeleton";
import { StaleDashboardDialog } from "@/modules/ee/analysis/dashboards/components/stale-dashboard-dialog";
import {
  ALL_TIME_VALUE,
  CUSTOM_VALUE,
  DATE_FILTER_FROM_PARAM,
  DATE_FILTER_PARAM,
  DATE_FILTER_TO_PARAM,
  type TDashboardDateFilter,
  parseDashboardDateFilter,
  toChartDateRange,
  writeStoredDateFilter,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-date-filter";
import {
  EDIT_HOTKEY,
  hasOpenOverlay,
  isEditHotkey,
  resolveEditHotkeyAction,
} from "@/modules/ee/analysis/dashboards/lib/edit-hotkey";
import {
  DEFAULT_WIDGET_VIEW,
  type TWidgetView,
  readStoredWidgetView,
  writeStoredWidgetView,
} from "@/modules/ee/analysis/dashboards/lib/widget-view";
import {
  type TAppDashboard,
  type TChartDateRangeInput,
  duplicateChart,
  getChartApiErrorMessage,
  getDashboard,
  isStaleDashboardError,
  removeDashboardWidget,
  replaceDashboard,
  restoreDashboardWidget,
} from "@/modules/ee/analysis/lib/api-client";
import { chartKeys, dashboardKeys } from "@/modules/ee/analysis/lib/query";
import type { TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { useDashboard } from "../hooks/use-dashboard";
import { draftOverLatest, toSavedWidgets, widgetsRemovedByOverwrite } from "../lib/stale-save";
import { findNextOpenSlot } from "../lib/widget-placement";

const ROW_HEIGHT = 80;

interface DashboardDetailClientProps {
  workspaceId: string;
  dashboardId: string;
  /** The filter persisted in this dashboard's cookie; a filter pinned in the URL wins over it. */
  storedDateFilter: TDashboardDateFilter | null;
  directories: { id: string; name: string }[];
  isReadOnly: boolean;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
}

const widgetsToLayout = (widgets: TDashboardWidget[]): LayoutItem[] => {
  return widgets.map((widget) => ({
    i: widget.id,
    x: widget.layout.x,
    y: widget.layout.y,
    w: widget.layout.w,
    h: widget.layout.h,
    minW: 2,
    minH: 3,
    maxW: 12,
    maxH: 8,
  }));
};

const widgetLayoutsChanged = (current: TDashboardWidget[], original: TDashboardWidget[]): boolean => {
  if (current.length !== original.length) return true;
  return current.some((widget, i) => {
    const orig = original[i];
    return (
      widget.id !== orig.id ||
      widget.layout.x !== orig.layout.x ||
      widget.layout.y !== orig.layout.y ||
      widget.layout.w !== orig.layout.w ||
      widget.layout.h !== orig.layout.h ||
      widget.order !== orig.order
    );
  });
};

const applyLayoutToWidgets = (widgets: TDashboardWidget[], newLayout: Layout): TDashboardWidget[] => {
  let changed = false;
  const updated = widgets.map((widget) => {
    const layoutItem = newLayout.find((l) => l.i === widget.id);
    if (!layoutItem) return widget;

    if (
      widget.layout.x === layoutItem.x &&
      widget.layout.y === layoutItem.y &&
      widget.layout.w === layoutItem.w &&
      widget.layout.h === layoutItem.h
    ) {
      return widget;
    }

    changed = true;
    return {
      ...widget,
      layout: {
        x: layoutItem.x,
        y: layoutItem.y,
        w: layoutItem.w,
        h: layoutItem.h,
      },
    };
  });

  return changed ? updated : widgets;
};

const MemoizedWidgetContent = memo(function WidgetContent({
  widget,
  dateRange,
  view,
}: Readonly<{
  widget: TDashboardWidget;
  dateRange: TChartDateRangeInput | null;
  view: TWidgetView;
}>) {
  return (
    <DashboardWidgetData
      chartId={widget.chartId}
      dateRange={dateRange}
      // Through resolveChartType like every other read of a stored type, so a row still
      // carrying a retired value renders as its replacement instead of "not yet supported".
      chartType={resolveChartType(widget.chart.type)}
      config={widget.chart.config}
      view={view}
    />
  );
});

const MemoizedWidgetItem = memo(function WidgetItem({
  widget,
  isEditing,
  dateRange,
  onEdit,
  onDuplicate,
  onResize,
  onRemove,
}: Readonly<{
  widget: TDashboardWidget;
  isEditing: boolean;
  dateRange: TChartDateRangeInput | null;
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
      <MemoizedWidgetContent widget={widget} dateRange={dateRange} view={view} />
    </DashboardWidget>
  );
});

/**
 * The dashboard page: the frame comes from one dashboard read, then every widget loads its own data
 * (`DashboardWidgetData`), so the page shows as soon as the dashboard is known.
 */
export function DashboardDetailClient(props: Readonly<DashboardDetailClientProps>) {
  const { t } = useTranslation();
  const { data: dashboard, isPending, error, refetch } = useDashboard(props.dashboardId);

  if (isPending) {
    return (
      <PageContentWrapper>
        <GoBackButton url={`/workspaces/${props.workspaceId}/dashboards`} />
        <div className="flex h-64 items-center justify-center" aria-busy="true">
          <DashboardWidgetSkeleton />
        </div>
      </PageContentWrapper>
    );
  }

  // A failed background refetch keeps the last dashboard (TanStack Query holds `data` on error), so the
  // full-page error is only for a dashboard that never loaded; replacing the view would drop an open edit.
  if (!dashboard) {
    return (
      <PageContentWrapper>
        <GoBackButton url={`/workspaces/${props.workspaceId}/dashboards`} />
        <ListLoadError
          error={error}
          onRetry={refetch}
          title={t("workspace.analysis.dashboards.failed_to_load_dashboard")}
        />
      </PageContentWrapper>
    );
  }

  return <DashboardDetailView {...props} dashboard={dashboard} />;
}

function DashboardDetailView({
  workspaceId,
  dashboard,
  storedDateFilter,
  directories,
  isReadOnly,
  isAIAvailable,
  aiUnavailableReason,
}: Readonly<Omit<DashboardDetailClientProps, "dashboardId"> & { dashboard: TAppDashboard }>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { width, containerRef, mounted } = useContainerWidth();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // The version the edit started from: what the save sends as its precondition, so a refetch while
  // editing can never make a save silently overwrite someone else's change.
  const [editBaseUpdatedAt, setEditBaseUpdatedAt] = useState<string | null>(null);
  // Set when a save was refused because the dashboard changed meanwhile: its latest version.
  const [staleLatest, setStaleLatest] = useState<TAppDashboard | null>(null);
  const [editingChartId, setEditingChartId] = useState<string | null>(null);

  // A filter pinned in the URL (a shared link, back/forward) wins; otherwise the one this viewer last
  // chose here, seeded from the cookie so the first fetch is already filtered.
  const [chosenDateFilter, setChosenDateFilter] = useState(storedDateFilter);
  const urlDateFilter = useMemo(
    () => parseDashboardDateFilter(Object.fromEntries(searchParams.entries())),
    [searchParams]
  );
  const dateFilter = urlDateFilter ?? chosenDateFilter;
  // Stable across renders for the same filter, so the memoized widgets do not re-render on every one.
  const dateRangeKey = JSON.stringify(toChartDateRange(dateFilter));
  const dateRange = useMemo(() => JSON.parse(dateRangeKey) as TChartDateRangeInput | null, [dateRangeKey]);

  /** After a write, read the dashboard again — and the lists that count its widgets. */
  const refreshDashboard = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.detail(dashboard.id) });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: chartKeys.lists() });
  }, [queryClient, dashboard.id]);

  // The name as the user typed it in edit mode, or `null` while they have not: the header otherwise shows the
  // dashboard's current name, so a rename made elsewhere shows on refetch and is never saved back over.
  const [draftName, setDraftName] = useState<string | null>(null);
  const name = draftName ?? dashboard.name;
  const [draftWidgets, setDraftWidgets] = useState<TDashboardWidget[] | null>(null);

  const widgets = draftWidgets ?? dashboard.widgets;

  const hasChanges = useMemo(() => {
    if (draftName !== null && draftName !== dashboard.name) return true;
    if (!draftWidgets) return false;
    return widgetLayoutsChanged(draftWidgets, dashboard.widgets);
  }, [draftName, draftWidgets, dashboard]);

  const layout = useMemo(() => widgetsToLayout(widgets), [widgets]);

  const handleInteractionEnd = useCallback(
    (finalLayout: Layout) => {
      setDraftWidgets((current) => applyLayoutToWidgets(current ?? dashboard.widgets, finalLayout));
    },
    [dashboard.widgets]
  );

  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      setDraftWidgets((current) => (current ?? dashboard.widgets).filter((w) => w.id !== widgetId));
    },
    [dashboard.widgets]
  );

  const handleEnterEditMode = useCallback(() => {
    if (isEditing) {
      return;
    }

    setDraftWidgets((current) => current ?? dashboard.widgets);
    setEditBaseUpdatedAt(dashboard.updatedAt);
    setIsEditing(true);
  }, [dashboard.widgets, dashboard.updatedAt, isEditing]);

  const handleEditChart = useCallback((chartId: string) => {
    setEditingChartId(chartId);
  }, []);

  const handleDuplicateWidget = useCallback(
    async (widget: TDashboardWidget) => {
      // The copy keeps the original's size and takes the first gap it fits, so it never lands on top of
      // the original.
      const slot = findNextOpenSlot(
        dashboard.widgets.map((current) => current.layout),
        widget.layout
      );
      try {
        await duplicateChart(widget.chartId, {
          dashboardId: dashboard.id,
          layout: { ...widget.layout, ...slot },
        });
        toast.success(t("workspace.analysis.dashboards.chart_duplicated"));
        refreshDashboard();
      } catch (error) {
        toast.error(
          getChartApiErrorMessage(error, t("workspace.analysis.dashboards.chart_duplicate_failed"))
        );
      }
    },
    [dashboard.id, dashboard.widgets, refreshDashboard, t]
  );

  const handleUndoRemoveWidget = useCallback(
    async (snapshot: TDashboardWidget) => {
      try {
        await restoreDashboardWidget(dashboard.id, snapshot);
        toast.success(t("workspace.analysis.dashboards.chart_restored"));
        refreshDashboard();
      } catch (error) {
        toast.error(getChartApiErrorMessage(error, t("workspace.analysis.dashboards.chart_restore_failed")));
      }
    },
    [dashboard.id, refreshDashboard, t]
  );

  const handleRemoveWidgetFromMenu = useCallback(
    async (widgetId: string) => {
      // In edit mode removal stays in draft state until save — no API call.
      if (isEditing) {
        handleRemoveWidget(widgetId);
        return;
      }

      const snapshot = (draftWidgets ?? dashboard.widgets).find((w) => w.id === widgetId);
      if (!snapshot) return;

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
        refreshDashboard();
      } catch (error) {
        toast.error(getChartApiErrorMessage(error, t("workspace.analysis.dashboards.chart_remove_failed")));
      }
    },
    [
      draftWidgets,
      dashboard.widgets,
      dashboard.id,
      handleRemoveWidget,
      handleUndoRemoveWidget,
      isEditing,
      refreshDashboard,
      t,
    ]
  );

  const handleCancel = useCallback(() => {
    setDraftName(null);
    setDraftWidgets(null);
    setEditBaseUpdatedAt(null);
    setIsEditing(false);
  }, []);

  /**
   * One call saves the name and every widget's place, carrying the `updatedAt` the edit started from.
   * If the dashboard changed since, nothing is saved and the editor chooses between the latest version
   * and their own.
   */
  const saveDashboard = useCallback(
    async (baseUpdatedAt: string, savedName: string, savedWidgets: TDashboardWidget[]) => {
      setIsSaving(true);
      try {
        const saved = await replaceDashboard(dashboard.id, {
          name: savedName.trim(),
          expectedUpdatedAt: baseUpdatedAt,
          widgets: toSavedWidgets(savedWidgets),
        });
        queryClient.setQueryData(dashboardKeys.detail(dashboard.id), saved);
        void queryClient.invalidateQueries({ queryKey: dashboardKeys.lists() });
        void queryClient.invalidateQueries({ queryKey: chartKeys.lists() });
        toast.success(t("workspace.analysis.dashboards.dashboard_saved"));
        setStaleLatest(null);
        setDraftName(null);
        setDraftWidgets(null);
        setEditBaseUpdatedAt(null);
        setIsEditing(false);
      } catch (error) {
        if (isStaleDashboardError(error)) {
          try {
            setStaleLatest(await getDashboard(dashboard.id));
          } catch (readError) {
            toast.error(
              getChartApiErrorMessage(readError, t("workspace.analysis.dashboards.dashboard_save_failed"))
            );
          }
          return;
        }
        toast.error(getChartApiErrorMessage(error, t("workspace.analysis.dashboards.dashboard_save_failed")));
      } finally {
        setIsSaving(false);
      }
    },
    [dashboard.id, queryClient, t]
  );

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error(t("workspace.analysis.dashboards.dashboard_name_required"));
      return;
    }
    await saveDashboard(editBaseUpdatedAt ?? dashboard.updatedAt, name, widgets);
  }, [name, saveDashboard, editBaseUpdatedAt, dashboard.updatedAt, widgets, t]);

  /** Discard the edit and show the dashboard as it now is. */
  const handleReloadLatest = useCallback(() => {
    if (!staleLatest) return;
    queryClient.setQueryData(dashboardKeys.detail(dashboard.id), staleLatest);
    setDraftName(null);
    setStaleLatest(null);
    setDraftWidgets(null);
    setEditBaseUpdatedAt(null);
    setIsEditing(false);
    refreshDashboard();
  }, [staleLatest, queryClient, dashboard.id, refreshDashboard]);

  /** Save the edit over the latest version, knowing what it removes. */
  const handleSaveAnyway = useCallback(() => {
    if (!staleLatest) return;
    // A name this editor did not touch is the latest one, so someone else's rename survives the overwrite.
    void saveDashboard(
      staleLatest.updatedAt,
      draftName ?? staleLatest.name,
      draftOverLatest(staleLatest.widgets, widgets)
    );
  }, [staleLatest, saveDashboard, draftName, widgets]);

  const removedByOverwrite = useMemo(
    () =>
      staleLatest
        ? widgetsRemovedByOverwrite(staleLatest.widgets, widgets).map((widget) => widget.chart.name)
        : [],
    [staleLatest, widgets]
  );

  // `E` toggles edit mode: it enters from view mode, and inside edit mode it saves when there is
  // something to save and cancels otherwise - the same button the key cap sits on in the control bar.
  useEffect(() => {
    const action = resolveEditHotkeyAction({ isReadOnly, isEditing, hasChanges, isSaving });
    if (!action) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isEditHotkey(event) || hasOpenOverlay()) {
        return;
      }

      event.preventDefault();
      if (action === "enter") handleEnterEditMode();
      else if (action === "save") void handleSave();
      else handleCancel();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCancel, handleEnterEditMode, handleSave, hasChanges, isEditing, isReadOnly, isSaving]);

  const applyDateFilterToUrl = useCallback(
    (filter: TDashboardDateFilter | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(DATE_FILTER_PARAM);
      params.delete(DATE_FILTER_FROM_PARAM);
      params.delete(DATE_FILTER_TO_PARAM);

      if (filter?.type === "all-time") {
        params.set(DATE_FILTER_PARAM, ALL_TIME_VALUE);
      } else if (filter?.type === "preset") {
        params.set(DATE_FILTER_PARAM, filter.value);
      } else if (filter?.type === "custom") {
        params.set(DATE_FILTER_PARAM, CUSTOM_VALUE);
        params.set(DATE_FILTER_FROM_PARAM, filter.range[0]);
        params.set(DATE_FILTER_TO_PARAM, filter.range[1]);
      }

      // A shallow history entry: the widgets refetch through their queries, so the page itself has
      // nothing to re-render on the server. Next.js keeps `useSearchParams` in step with it.
      const queryString = params.toString();
      window.history.pushState(null, "", queryString ? `${pathname}?${queryString}` : pathname);
    },
    [pathname, searchParams]
  );

  const handleDateFilterChange = useCallback(
    (filter: TDashboardDateFilter | null) => {
      // Persist the choice (cookie) so it survives across sessions and seeds the next visit's first
      // fetch, then reflect it in the URL so the view can be shared.
      writeStoredDateFilter(dashboard.id, filter);
      setChosenDateFilter(filter);
      applyDateFilterToUrl(filter);
    },
    [applyDateFilterToUrl, dashboard.id]
  );

  const isEmpty = widgets.length === 0;

  // The cookie is read by the server and seeds `chosenDateFilter`, so there is no client-side restore
  // effect. A pinned URL param still wins and is intentionally NOT written back to the cookie, so
  // opening a shared link never overwrites the viewer's own saved preference.

  return (
    <PageContentWrapper>
      <GoBackButton url={`/workspaces/${workspaceId}/dashboards`} />
      <DashboardPageHeader
        name={name}
        isEditing={isEditing}
        onNameChange={setDraftName}
        cta={
          <DashboardControlBar
            workspaceId={workspaceId}
            dashboardId={dashboard.id}
            directories={directories}
            isEditing={isEditing}
            isSaving={isSaving}
            hasChanges={hasChanges}
            isReadOnly={isReadOnly}
            isAIAvailable={isAIAvailable}
            aiUnavailableReason={aiUnavailableReason}
            onRefresh={() => {
              refreshDashboard();
              void queryClient.invalidateQueries({ queryKey: chartKeys.allData() });
            }}
            editHotkey={EDIT_HOTKEY}
            onEditToggle={handleEnterEditMode}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        }
      />

      <StaleDashboardDialog
        open={staleLatest !== null}
        removedChartNames={removedByOverwrite}
        isSaving={isSaving}
        onReload={handleReloadLatest}
        onSaveAnyway={handleSaveAnyway}
        onOpenChange={(open) => {
          if (!open) setStaleLatest(null);
        }}
      />

      {/* The date range only filters existing charts, so hide it on an empty dashboard where it
          would have nothing to act on. */}
      {!isEditing && !isEmpty && (
        <div className="flex flex-wrap items-center gap-2">
          <DashboardDateFilter value={dateFilter} onChange={handleDateFilterChange} />
        </div>
      )}

      <section>
        <div ref={containerRef} className="w-full">
          {isEmpty ? (
            <EmptyState text={t("workspace.analysis.dashboards.no_data_message")} />
          ) : (
            mounted && (
              <ResponsiveGridLayout
                width={width}
                layouts={{ lg: layout }}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={ROW_HEIGHT}
                margin={[16, 16]}
                // Keep 16px only between items; drop the default container padding (which mirrors
                // margin) so the grid sits flush with the container's left/top edge, aligned with
                // the date filter above instead of inset from it.
                containerPadding={[0, 0]}
                dragConfig={{
                  enabled: isEditing,
                  handle: ".rgl-drag-handle",
                  bounded: false,
                  threshold: 5,
                }}
                resizeConfig={{
                  enabled: isEditing,
                  handles: ["n", "s", "e", "w", "ne", "nw", "se", "sw"],
                }}
                compactor={verticalCompactor}
                onDragStop={(finalLayout) => handleInteractionEnd(finalLayout)}
                onResizeStop={(finalLayout) => handleInteractionEnd(finalLayout)}>
                {widgets.map((widget) => (
                  <div key={widget.id}>
                    <MemoizedWidgetItem
                      widget={widget}
                      isEditing={isEditing}
                      dateRange={dateRange}
                      onEdit={isReadOnly ? undefined : () => handleEditChart(widget.chartId)}
                      // Duplicate is hidden in edit mode: saving edit-mode drafts removes any
                      // widget not present in the draft, which would delete the fresh copy.
                      onDuplicate={isReadOnly || isEditing ? undefined : () => handleDuplicateWidget(widget)}
                      onResize={isReadOnly ? undefined : handleEnterEditMode}
                      onRemove={isReadOnly ? undefined : () => handleRemoveWidgetFromMenu(widget.id)}
                    />
                  </div>
                ))}
              </ResponsiveGridLayout>
            )
          )}
        </div>
      </section>
      {!isReadOnly && (
        <CreateChartDialog
          open={editingChartId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setEditingChartId(null);
            }
          }}
          workspaceId={workspaceId}
          chartId={editingChartId ?? undefined}
          onSuccess={() => {
            setEditingChartId(null);
            refreshDashboard();
            void queryClient.invalidateQueries({ queryKey: chartKeys.allData() });
          }}
          directories={directories}
        />
      )}
    </PageContentWrapper>
  );
}
