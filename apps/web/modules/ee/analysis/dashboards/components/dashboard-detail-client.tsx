"use client";

import { useRouter } from "next/navigation";
import { Suspense, memo, useCallback, useMemo, useState, useTransition } from "react";
import { ResponsiveGridLayout, useContainerWidth, verticalCompactor } from "react-grid-layout";
import type { Layout, LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import "react-resizable/css/styles.css";
import type { TChartQuery } from "@formbricks/types/analysis";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { CreateChartDialog } from "@/modules/ee/analysis/charts/components/create-chart-dialog";
import type { TAIUnavailableReason } from "@/modules/ee/analysis/charts/lib/ai-availability";
import { DashboardControlBar } from "@/modules/ee/analysis/dashboards/components/dashboard-control-bar";
import { DashboardPageHeader } from "@/modules/ee/analysis/dashboards/components/dashboard-page-header";
import { DashboardWidget } from "@/modules/ee/analysis/dashboards/components/dashboard-widget";
import { DashboardWidgetData } from "@/modules/ee/analysis/dashboards/components/dashboard-widget-data";
import { DashboardWidgetSkeleton } from "@/modules/ee/analysis/dashboards/components/dashboard-widget-skeleton";
import type { TChartDataRow, TDashboardDetail, TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import {
  addChartToDashboardAction,
  duplicateChartAndAddWidgetAction,
  removeWidgetFromDashboardAction,
  updateDashboardAction,
  updateWidgetLayoutsAction,
} from "../actions";
import type { TDashboardWidgetError } from "../lib/widget-errors";

const ROW_HEIGHT = 80;

interface DashboardDetailClientProps {
  workspaceId: string;
  dashboard: TDashboardDetail;
  widgetDataPromises: Map<
    string,
    Promise<
      | { data: TChartDataRow[]; query: TChartQuery; optionLabels?: Record<string, string> }
      | { error: TDashboardWidgetError }
    >
  >;
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
  dataPromise,
}: Readonly<{
  widget: TDashboardWidget;
  dataPromise?: Promise<
    | { data: TChartDataRow[]; query: TChartQuery; optionLabels?: Record<string, string> }
    | { error: TDashboardWidgetError }
  >;
}>) {
  if (widget.chart && dataPromise) {
    return (
      <Suspense fallback={<DashboardWidgetSkeleton />}>
        <DashboardWidgetData dataPromise={dataPromise} chartType={widget.chart.type} />
      </Suspense>
    );
  }
  return <DashboardWidgetSkeleton />;
});

const MemoizedWidgetItem = memo(function WidgetItem({
  widget,
  isEditing,
  dataPromise,
  onEdit,
  onDuplicate,
  onResize,
  onRemove,
}: Readonly<{
  widget: TDashboardWidget;
  isEditing: boolean;
  dataPromise?: Promise<
    | { data: TChartDataRow[]; query: TChartQuery; optionLabels?: Record<string, string> }
    | { error: TDashboardWidgetError }
  >;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onResize?: () => void;
  onRemove?: () => void;
}>) {
  const title = widget.chart?.name ?? "";

  return (
    <DashboardWidget
      title={title}
      isEditing={isEditing}
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      onResize={onResize}
      onRemove={onRemove}>
      <MemoizedWidgetContent widget={widget} dataPromise={dataPromise} />
    </DashboardWidget>
  );
});

export function DashboardDetailClient({
  workspaceId,
  dashboard,
  widgetDataPromises,
  directories,
  isReadOnly,
  isAIAvailable,
  aiUnavailableReason,
}: Readonly<DashboardDetailClientProps>) {
  const router = useRouter();
  const { t } = useTranslation();
  const { width, containerRef, mounted } = useContainerWidth();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [name, setName] = useState(dashboard.name);
  const [draftWidgets, setDraftWidgets] = useState<TDashboardWidget[] | null>(null);

  const widgets = draftWidgets ?? dashboard.widgets;

  const hasChanges = useMemo(() => {
    if (name !== dashboard.name) return true;
    if (!draftWidgets) return false;
    return widgetLayoutsChanged(draftWidgets, dashboard.widgets);
  }, [name, draftWidgets, dashboard]);

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
    setIsEditing(true);
  }, [dashboard.widgets, isEditing]);

  const handleEditChart = useCallback((chartId: string) => {
    setEditingChartId(chartId);
  }, []);

  const handleDuplicateWidget = useCallback(
    async (widget: TDashboardWidget) => {
      try {
        const result = await duplicateChartAndAddWidgetAction({
          workspaceId,
          dashboardId: dashboard.id,
          chartId: widget.chartId,
          layout: widget.layout,
        });
        if (!result?.data) {
          toast.error(getFormattedErrorMessage(result));
          return;
        }
        toast.success(t("workspace.analysis.dashboards.chart_duplicated"));
        startTransition(() => router.refresh());
      } catch {
        toast.error(t("workspace.analysis.dashboards.chart_duplicate_failed"));
      }
    },
    [workspaceId, dashboard.id, router, t, startTransition]
  );

  const handleUndoRemoveWidget = useCallback(
    async (snapshot: TDashboardWidget) => {
      try {
        const result = await addChartToDashboardAction({
          workspaceId,
          dashboardId: dashboard.id,
          chartId: snapshot.chartId,
          layout: snapshot.layout,
          respectY: true,
        });
        if (!result?.data) {
          toast.error(getFormattedErrorMessage(result));
          return;
        }
        toast.success(t("workspace.analysis.dashboards.chart_restored"));
        startTransition(() => router.refresh());
      } catch {
        toast.error(t("workspace.analysis.dashboards.chart_restore_failed"));
      }
    },
    [workspaceId, dashboard.id, router, t, startTransition]
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
        const result = await removeWidgetFromDashboardAction({
          workspaceId,
          dashboardId: dashboard.id,
          widgetId,
        });
        if (!result?.data) {
          toast.error(getFormattedErrorMessage(result));
          return;
        }

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
        startTransition(() => router.refresh());
      } catch {
        toast.error(t("workspace.analysis.dashboards.chart_remove_failed"));
      }
    },
    [
      draftWidgets,
      dashboard.widgets,
      dashboard.id,
      handleRemoveWidget,
      handleUndoRemoveWidget,
      isEditing,
      router,
      startTransition,
      t,
      workspaceId,
    ]
  );

  const handleCancel = useCallback(() => {
    setName(dashboard.name);
    setDraftWidgets(null);
    setIsEditing(false);
  }, [dashboard]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error(t("workspace.analysis.dashboards.dashboard_name_required"));
      return;
    }

    setIsSaving(true);

    try {
      if (name !== dashboard.name) {
        const dashboardResult = await updateDashboardAction({
          workspaceId,
          dashboardId: dashboard.id,
          name: name.trim(),
        });

        if (!dashboardResult?.data) {
          const errorMessage = getFormattedErrorMessage(dashboardResult);
          toast.error(errorMessage);
          setIsSaving(false);
          return;
        }
      }

      if (widgetLayoutsChanged(widgets, dashboard.widgets)) {
        const widgetUpdates = widgets.map((widget, i) => ({
          id: widget.id,
          layout: widget.layout,
          order: i,
        }));

        const widgetsResult = await updateWidgetLayoutsAction({
          workspaceId,
          dashboardId: dashboard.id,
          widgets: widgetUpdates,
        });

        if (!widgetsResult?.data) {
          const errorMessage = getFormattedErrorMessage(widgetsResult);
          toast.error(errorMessage);
          setIsSaving(false);
          return;
        }
      }

      toast.success(t("workspace.analysis.dashboards.dashboard_saved"));
      startTransition(() => {
        router.refresh();
        setDraftWidgets(null);
        setIsEditing(false);
      });
    } catch {
      toast.error(t("workspace.analysis.dashboards.dashboard_save_failed"));
    } finally {
      setIsSaving(false);
    }
  }, [name, widgets, dashboard, workspaceId, router, t, startTransition]);

  const isEmpty = widgets.length === 0;

  return (
    <PageContentWrapper>
      <GoBackButton url={`/workspaces/${workspaceId}/dashboards`} />
      <DashboardPageHeader
        name={name}
        isEditing={isEditing}
        onNameChange={setName}
        cta={
          <DashboardControlBar
            workspaceId={workspaceId}
            dashboardId={dashboard.id}
            directories={directories}
            existingChartIds={widgets.map((w) => w.chartId)}
            isEditing={isEditing}
            isSaving={isSaving}
            hasChanges={hasChanges}
            isReadOnly={isReadOnly}
            isAIAvailable={isAIAvailable}
            aiUnavailableReason={aiUnavailableReason}
            onRefresh={() => router.refresh()}
            onEditToggle={handleEnterEditMode}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        }
      />

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
                      dataPromise={widgetDataPromises.get(widget.id)}
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
            startTransition(() => {
              router.refresh();
            });
          }}
          directories={directories}
          isAIAvailable={isAIAvailable}
          aiUnavailableReason={aiUnavailableReason}
        />
      )}
    </PageContentWrapper>
  );
}
