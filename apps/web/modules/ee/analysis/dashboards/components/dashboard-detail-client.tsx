"use client";

import { Delay } from "@suspensive/react";
import { useRouter } from "next/navigation";
import { Suspense, memo, useCallback, useMemo, useState, useTransition } from "react";
import { ResponsiveGridLayout, useContainerWidth, verticalCompactor } from "react-grid-layout";
import type { Layout, LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import "react-resizable/css/styles.css";
import type { TChartQuery } from "@formbricks/types/analysis";
import type { TChartDataRow, TDashboardDetail, TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { updateDashboardAction, updateWidgetLayoutsAction } from "../actions";
import { DashboardControlBar } from "./dashboard-control-bar";
import { DashboardPageHeader } from "./dashboard-page-header";
import { DashboardWidget } from "./dashboard-widget";
import { DashboardWidgetData } from "./dashboard-widget-data";
import { DashboardWidgetSkeleton } from "./dashboard-widget-skeleton";

const ROW_HEIGHT = 80;

interface DashboardDetailClientProps {
  environmentId: string;
  dashboard: TDashboardDetail;
  widgetDataPromises: Map<string, Promise<{ data: TChartDataRow[]; query: TChartQuery } | { error: string }>>;
  isReadOnly: boolean;
}

function widgetsToLayout(widgets: TDashboardWidget[]): LayoutItem[] {
  return widgets.map((widget) => ({
    i: widget.id,
    x: widget.layout.x,
    y: widget.layout.y,
    w: widget.layout.w,
    h: widget.layout.h,
    minW: 2,
    minH: 2,
    maxW: 12,
    maxH: 8,
  }));
}

function widgetLayoutsChanged(current: TDashboardWidget[], original: TDashboardWidget[]): boolean {
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
}

function applyLayoutToWidgets(widgets: TDashboardWidget[], newLayout: Layout): TDashboardWidget[] {
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
}

const MemoizedWidgetContent = memo(function WidgetContent({
  widget,
  dataPromise,
}: Readonly<{
  widget: TDashboardWidget;
  dataPromise?: Promise<{ data: TChartDataRow[]; query: TChartQuery } | { error: string }>;
}>) {
  if (widget.chart && dataPromise) {
    return (
      <Suspense
        fallback={
          <Delay ms={200}>
            <DashboardWidgetSkeleton />
          </Delay>
        }>
        <DashboardWidgetData
          dataPromise={dataPromise}
          chartType={widget.chart.type}
          query={widget.chart.query}
        />
      </Suspense>
    );
  }
  return <DashboardWidgetSkeleton />;
});

const MemoizedWidgetItem = memo(function WidgetItem({
  widget,
  isEditing,
  dataPromise,
  onRemove,
}: Readonly<{
  widget: TDashboardWidget;
  isEditing: boolean;
  dataPromise?: Promise<{ data: TChartDataRow[]; query: TChartQuery } | { error: string }>;
  onRemove?: () => void;
}>) {
  const title = widget.title || widget.chart?.name || "Widget";

  return (
    <DashboardWidget title={title} isEditing={isEditing} onRemove={onRemove}>
      <MemoizedWidgetContent widget={widget} dataPromise={dataPromise} />
    </DashboardWidget>
  );
});

export function DashboardDetailClient({
  environmentId,
  dashboard,
  widgetDataPromises,
  isReadOnly,
}: Readonly<DashboardDetailClientProps>) {
  const router = useRouter();
  const { t } = useTranslation();
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1200 });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  const handleInteractionEnd = useCallback((finalLayout: Layout) => {
    setDraftWidgets((current) => applyLayoutToWidgets(current ?? [], finalLayout));
  }, []);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setDraftWidgets((current) => (current ?? []).filter((w) => w.id !== widgetId));
  }, []);

  const handleCancel = useCallback(() => {
    setName(dashboard.name);
    setDraftWidgets(null);
    setIsEditing(false);
  }, [dashboard]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error(t("environments.analysis.dashboards.dashboard_name_required"));
      return;
    }

    setIsSaving(true);

    try {
      if (name !== dashboard.name) {
        const dashboardResult = await updateDashboardAction({
          environmentId,
          dashboardId: dashboard.id,
          name: name.trim(),
        });

        if (!dashboardResult?.data) {
          toast.error(
            dashboardResult?.serverError || t("environments.analysis.dashboards.dashboard_update_failed")
          );
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
          environmentId,
          dashboardId: dashboard.id,
          widgets: widgetUpdates,
        });

        if (!widgetsResult?.data) {
          toast.error(
            widgetsResult?.serverError || t("environments.analysis.dashboards.widget_layouts_save_failed")
          );
          setIsSaving(false);
          return;
        }
      }

      toast.success(t("environments.analysis.dashboards.dashboard_saved"));
      startTransition(() => {
        router.refresh();
        setDraftWidgets(null);
        setIsEditing(false);
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("environments.analysis.dashboards.dashboard_save_failed");
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }, [name, widgets, dashboard, environmentId, router, t, startTransition]);

  const isEmpty = widgets.length === 0;

  return (
    <PageContentWrapper>
      {/* eslint-disable-next-line react/no-danger */}
      {/* <style dangerouslySetInnerHTML={{ __html: gridStyles }} />  */}
      <GoBackButton url={`/environments/${environmentId}/analysis/dashboards`} />
      <DashboardPageHeader
        name={name}
        isEditing={isEditing}
        onNameChange={setName}
        cta={
          <DashboardControlBar
            environmentId={environmentId}
            dashboardId={dashboard.id}
            existingChartIds={widgets.map((w) => w.chartId)}
            isEditing={isEditing}
            isSaving={isSaving}
            hasChanges={hasChanges}
            isReadOnly={isReadOnly}
            onRefresh={() => router.refresh()}
            onEditToggle={() => {
              setDraftWidgets(dashboard.widgets);
              setIsEditing(true);
            }}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        }
      />

      <section>
        {isEmpty ? (
          <EmptyState
            text={`${t("environments.analysis.dashboards.no_data_title")}. ${t(
              "environments.analysis.dashboards.no_data_description"
            )}`}
          />
        ) : (
          <div ref={containerRef}>
            {mounted && (
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
                      onRemove={isEditing ? () => handleRemoveWidget(widget.id) : undefined}
                    />
                  </div>
                ))}
              </ResponsiveGridLayout>
            )}
          </div>
        )}
      </section>
    </PageContentWrapper>
  );
}
