"use client";

import { Delay } from "@suspensive/react";
import { memo, Suspense, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  verticalCompactor,
} from "react-grid-layout";
import type { Layout, LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const gridStyles = `
  .react-grid-item.react-draggable-dragging {
    opacity: 0.7;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    z-index: 100;
  }
`;
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { CreateChartButton } from "@/modules/ee/analysis/charts/components/create-chart-button";
import { DashboardControlBar } from "./dashboard-control-bar";
import { DashboardWidgetSkeleton } from "./dashboard-widget-skeleton";
import { DashboardWidget } from "./dashboard-widget";
import { DashboardWidgetData } from "./dashboard-widget-data";
import { EditableDashboardHeader } from "./editable-dashboard-header";
import { TDashboard, TDashboardWidget } from "../../types/analysis";
import { updateDashboardAction, updateWidgetLayoutsAction } from "../actions";

const ROW_HEIGHT = 80;

interface DashboardDetailClientProps {
  environmentId: string;
  dashboard: TDashboard;
  widgetDataPromises: Map<string, Promise<{ data: Record<string, unknown>[] } | { error: string }>>;
}

function StaticWidgetContent({ widget }: { widget: TDashboardWidget }) {
  if (widget.type === "markdown") {
    return (
      <div className="prose prose-sm max-w-none">
        <p className="text-gray-500">Markdown widget placeholder</p>
      </div>
    );
  }

  if (widget.type === "header") {
    return (
      <div className="flex h-full items-center">
        <h2 className="text-2xl font-semibold text-gray-900">{widget.title || "Header"}</h2>
      </div>
    );
  }

  if (widget.type === "divider") {
    return <div className="h-full w-full border-t border-gray-200" />;
  }

  return null;
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
}: {
  widget: TDashboardWidget;
  dataPromise?: Promise<{ data: Record<string, unknown>[] } | { error: string }>;
}) {
  if (widget.type === "chart" && widget.chart) {
    if (dataPromise) {
      return (
        <Suspense
          fallback={
            <Delay ms={200}>
              <DashboardWidgetSkeleton />
            </Delay>
          }>
          <DashboardWidgetData dataPromise={dataPromise} chartType={widget.chart.type} />
        </Suspense>
      );
    }
    return <DashboardWidgetSkeleton />;
  }
  return <StaticWidgetContent widget={widget} />;
});

const MemoizedWidgetItem = memo(function WidgetItem({
  widget,
  isEditing,
  dataPromise,
  onRemove,
}: {
  widget: TDashboardWidget;
  isEditing: boolean;
  dataPromise?: Promise<{ data: Record<string, unknown>[] } | { error: string }>;
  onRemove?: () => void;
}) {
  const title =
    widget.title || (widget.type === "chart" && widget.chart ? widget.chart.name : "Widget") || "Widget";

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
}: DashboardDetailClientProps) {
  const router = useRouter();
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1200 });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState(dashboard.name);
  const [description, setDescription] = useState(dashboard.description || "");
  const [widgets, setWidgets] = useState<TDashboardWidget[]>(dashboard.widgets);

  const hasChanges = useMemo(() => {
    if (name !== dashboard.name) return true;
    if (description !== (dashboard.description || "")) return true;
    if (JSON.stringify(widgets) !== JSON.stringify(dashboard.widgets)) return true;
    return false;
  }, [name, description, widgets, dashboard]);

  const layout = useMemo(() => widgetsToLayout(widgets), [widgets]);

  const handleInteractionEnd = useCallback((finalLayout: Layout) => {
    setWidgets((current) => applyLayoutToWidgets(current, finalLayout));
  }, []);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setWidgets((current) => current.filter((w) => w.id !== widgetId));
  }, []);

  const handleCancel = useCallback(() => {
    setName(dashboard.name);
    setDescription(dashboard.description || "");
    setWidgets(dashboard.widgets);
    setIsEditing(false);
  }, [dashboard]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Dashboard name is required");
      return;
    }

    setIsSaving(true);

    try {
      if (name !== dashboard.name || description !== (dashboard.description || "")) {
        const dashboardResult = await updateDashboardAction({
          environmentId,
          dashboardId: dashboard.id,
          name: name.trim(),
          description: description.trim() || null,
        });

        if (!dashboardResult?.data) {
          toast.error(dashboardResult?.serverError || "Failed to update dashboard");
          setIsSaving(false);
          return;
        }
      }

      if (JSON.stringify(widgets) !== JSON.stringify(dashboard.widgets)) {
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
          toast.error(widgetsResult?.serverError || "Failed to update widget layouts");
          setIsSaving(false);
          return;
        }
      }

      toast.success("Dashboard saved successfully");
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save dashboard";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }, [name, description, widgets, dashboard, environmentId, router]);

  const isEmpty = widgets.length === 0;

  return (
    <PageContentWrapper>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: gridStyles }} />
      <GoBackButton url={`/environments/${environmentId}/analysis/dashboards`} />
      <EditableDashboardHeader
        name={name}
        description={description}
        isEditing={isEditing}
        onNameChange={setName}
        onDescriptionChange={setDescription}
      >
        <DashboardControlBar
          environmentId={environmentId}
          dashboard={dashboard}
          isEditing={isEditing}
          isSaving={isSaving}
          hasChanges={hasChanges}
          onRefresh={() => router.refresh()}
          onEditToggle={() => setIsEditing(true)}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </EditableDashboardHeader>

      <section className="pb-24 pt-6">
        {isEmpty ? (
          <div className="flex h-[400px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white/50">
            <div className="mb-4 rounded-full bg-gray-100 p-4">
              <div className="h-12 w-12 rounded-md bg-gray-300 opacity-20" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No Data</h3>
            <p className="mt-2 max-w-sm text-center text-gray-500">
              There is currently no information to display. Add charts to build your dashboard.
            </p>
            <CreateChartButton environmentId={environmentId} />
          </div>
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
                onResizeStop={(finalLayout) => handleInteractionEnd(finalLayout)}
              >
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
