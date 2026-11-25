"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveGridLayout, useContainerWidth, verticalCompactor } from "react-grid-layout";
import type { Layout, LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import "react-resizable/css/styles.css";
import type { TDashboardImageContent, TDashboardTextContent } from "@formbricks/types/analysis";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { CreateChartDialog } from "@/modules/ee/analysis/charts/components/create-chart-dialog";
import { resolveChartType } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { ListLoadError } from "@/modules/ee/analysis/components/list-load-error";
import { AddExistingChartsDialog } from "@/modules/ee/analysis/dashboards/components/add-existing-charts-dialog";
import {
  AccessButton,
  type TViewAsMember,
  ViewAsBanner,
  ViewAsButton,
} from "@/modules/ee/analysis/dashboards/components/dashboard-access-controls";
import { DashboardControlBar } from "@/modules/ee/analysis/dashboards/components/dashboard-control-bar";
import { DashboardDateFilter } from "@/modules/ee/analysis/dashboards/components/dashboard-date-filter";
import { DashboardLayoutBlock } from "@/modules/ee/analysis/dashboards/components/dashboard-layout-block";
import { DashboardPageHeader } from "@/modules/ee/analysis/dashboards/components/dashboard-page-header";
import { DashboardPageTabs } from "@/modules/ee/analysis/dashboards/components/dashboard-page-tabs";
import { DashboardWidget } from "@/modules/ee/analysis/dashboards/components/dashboard-widget";
import { DashboardWidgetData } from "@/modules/ee/analysis/dashboards/components/dashboard-widget-data";
import { DashboardWidgetSkeleton } from "@/modules/ee/analysis/dashboards/components/dashboard-widget-skeleton";
import { LockFiltersButton } from "@/modules/ee/analysis/dashboards/components/lock-filters-button";
import { ManagePagesDialog } from "@/modules/ee/analysis/dashboards/components/manage-pages-dialog";
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
  addDraftBlock,
  addDraftCharts,
  addDraftPage,
  deleteDraftPage,
  findEmptyTextBlocks,
  isDraftId,
  moveDraftPage,
  pagesChanged,
  renameDraftPage,
  resolveSelectedPageId,
  setDraftPageTeams,
  toSavedPages,
  widgetsChanged,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-draft";
import {
  type TDashboardFilterState,
  exceedsFiltersBudget,
  keepValidFilters,
  readFiltersFromUrl,
  writeFiltersToUrl,
  writeStoredFilters,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-state";
import { MAX_DASHBOARD_FILTERS } from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import {
  EDIT_HOTKEY,
  hasOpenOverlay,
  isEditHotkey,
  resolveEditHotkeyAction,
} from "@/modules/ee/analysis/dashboards/lib/edit-hotkey";
import { MAX_DASHBOARD_PAGES } from "@/modules/ee/analysis/dashboards/lib/page-names";
import {
  type TLayoutBlockKind,
  fitBlockHeights,
  getBlockMinSize,
  isAutoHeightBlock,
  pixelsToGridRows,
} from "@/modules/ee/analysis/dashboards/lib/widget-blocks";
import {
  DEFAULT_WIDGET_VIEW,
  type TWidgetView,
  readStoredWidgetView,
  writeStoredWidgetView,
} from "@/modules/ee/analysis/dashboards/lib/widget-view";
import {
  type TAppChart,
  type TAppDashboard,
  type TChartDateRangeInput,
  duplicateChart,
  getChartApiErrorMessage,
  getDashboard,
  getDashboardPageAccess,
  isStaleDashboardError,
  removeDashboardWidget,
  replaceDashboard,
  restoreDashboardWidget,
} from "@/modules/ee/analysis/lib/api-client";
import { chartKeys, dashboardKeys } from "@/modules/ee/analysis/lib/query";
import type {
  TDashboardChartWidget,
  TDashboardPage,
  TDashboardWidget,
} from "@/modules/ee/analysis/types/analysis";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { TableToolbar } from "@/modules/ui/components/table-toolbar";
import { useDashboard } from "../hooks/use-dashboard";
import { useDashboardToolbarFilters } from "../hooks/use-dashboard-toolbar-filters";
import { useLockedDashboardFilters } from "../hooks/use-locked-dashboard-filters";
import {
  draftOverLatest,
  draftPagesOverLatest,
  toSavedWidgets,
  widgetsRemovedByOverwrite,
} from "../lib/stale-save";
import { GRID_COLUMNS, MAX_WIDGET_HEIGHT, findNextOpenSlot, getWidgetMinSize } from "../lib/widget-placement";

// Rows are 8px with 16px between them, so a unit is 24px: fine enough for a block to fit its content
// (4 units are what one 80px row was).
const ROW_HEIGHT = 8;
const GRID_MARGIN = 16;

/** The query parameter the selected page is kept in, so a link opens the same page. */
const PAGE_PARAM = "page";

const NO_WIDGET_IDS: ReadonlySet<string> = new Set();

interface DashboardDetailClientProps {
  workspaceId: string;
  dashboardId: string;
  /** The filter persisted in this dashboard's cookie; a filter pinned in the URL wins over it. */
  storedDateFilter: TDashboardDateFilter | null;
  /** The filters persisted in this dashboard's cookie; filters pinned in the URL win over them. */
  storedFilters: TDashboardFilterState[];
  directories: { id: string; name: string }[];
  isReadOnly: boolean;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
  /** Owners and Managers with Access Control and Dashboards: the "View as" and "Access" buttons (ENG-7484). */
  canManageAccess?: boolean;
  /** The member the page is viewed as (View as): read-only, with a banner to stop. */
  viewAsMember?: TViewAsMember | null;
}

const isEmptyImageBlock = (widget: TDashboardWidget): boolean =>
  widget.kind === "image" && widget.content.fileUrl === null;

const SIDE_RESIZE_HANDLES: LayoutItem["resizeHandles"] = ["e", "w"];

const widgetsToLayout = (
  widgets: TDashboardWidget[],
  neededRows: ReadonlyMap<string, number>
): LayoutItem[] =>
  widgets.map((widget) => {
    const minSize =
      widget.kind === "chart"
        ? getWidgetMinSize(resolveChartType(widget.chart.type))
        : getBlockMinSize(widget.kind);
    return {
      i: widget.id,
      x: widget.layout.x,
      y: widget.layout.y,
      w: Math.max(widget.layout.w, minSize.minW),
      // The API and MCP tools take any size; a chart saved smaller than the editor allows is drawn at its
      // minimum, so it stays readable (the next save keeps that size).
      h: widget.kind === "chart" ? Math.max(widget.layout.h, minSize.minH) : widget.layout.h,
      ...minSize,
      maxW: GRID_COLUMNS,
      // A separator keeps its height, so a resize only changes its width and it only gets the side
      // handles. An image or text block can be made taller to line up with its neighbours, never shorter
      // than its content.
      ...(widget.kind === "separator"
        ? { minH: widget.layout.h, maxH: widget.layout.h, resizeHandles: SIDE_RESIZE_HANDLES }
        : {
            maxH: MAX_WIDGET_HEIGHT,
            ...(widget.kind === "chart" ? {} : { minH: neededRows.get(widget.id) ?? minSize.minH }),
          }),
    };
  });

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
      layout: { x: layoutItem.x, y: layoutItem.y, w: layoutItem.w, h: layoutItem.h },
    };
  });

  return changed ? updated : widgets;
};

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

const MemoizedWidgetItem = memo(function WidgetItem({
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
    // eslint-disable-next-line react/set-state-in-effect -- localStorage exists only after hydration (see above)
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
        {/* Viewing as someone keeps the banner and its way back, whatever the read answered. */}
        {props.viewAsMember && <ViewAsBanner member={props.viewAsMember} />}
        {/* A 403 while viewing as someone is the answer, not a failure: they cannot see this dashboard. */}
        {props.viewAsMember && error instanceof V3ApiError && error.status === 403 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">
              {t("workspace.analysis.dashboards.view_as_no_access_title", {
                member: props.viewAsMember.name,
              })}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t("workspace.analysis.dashboards.view_as_no_access_subtitle")}
            </p>
          </div>
        ) : (
          <ListLoadError
            error={error}
            onRetry={refetch}
            title={t("workspace.analysis.dashboards.failed_to_load_dashboard")}
          />
        )}
      </PageContentWrapper>
    );
  }

  return <DashboardDetailView {...props} dashboard={dashboard} />;
}

function DashboardDetailView({
  workspaceId,
  dashboard,
  storedDateFilter,
  storedFilters,
  directories,
  isReadOnly,
  isAIAvailable,
  aiUnavailableReason,
  canManageAccess = false,
  viewAsMember = null,
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
  // The widgets the edit started with. The stale warning lists what a whole-dashboard save removes that
  // the editor never removed itself; without this, their own removals read as "added meanwhile".
  const [editBaseWidgetIds, setEditBaseWidgetIds] = useState<ReadonlySet<string> | null>(null);
  // The pages the edit started with: a save sends a page's team limit only where it changed from these.
  const [editBasePages, setEditBasePages] = useState<TDashboardPage[] | null>(null);
  // Set when a save was refused because the dashboard changed meanwhile: its latest version.
  const [staleLatest, setStaleLatest] = useState<TAppDashboard | null>(null);
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [isAddChartsOpen, setIsAddChartsOpen] = useState(false);
  const [isManagePagesOpen, setIsManagePagesOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<TDashboardPage | null>(null);
  const [isDeletePageOpen, setIsDeletePageOpen] = useState(false);

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

  // The filters follow the date's rule: pinned in the URL wins, otherwise the ones this person last set here.
  // A remembered value stays applied even where it no longer occurs.
  const [chosenFilters, setChosenFilters] = useState(storedFilters);
  const urlFilters = useMemo(
    () => readFiltersFromUrl(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );
  const filtersKey = JSON.stringify(urlFilters ?? chosenFilters);
  const filters = useMemo(() => JSON.parse(filtersKey) as TDashboardFilterState[], [filtersKey]);

  /** After a write, read the dashboard again — and the lists that count its widgets. */
  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardKeys.detail(dashboard.id) }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: chartKeys.lists() }),
    ]);
  }, [queryClient, dashboard.id]);

  /**
   * Writes made outside edit mode — duplicate, remove, undo — move the dashboard's version on the server.
   * They are counted so entering edit mode waits for them: pinning the edit's base from a copy read before
   * one of them landed would make the first save look stale, and offer to drop the change just made.
   */
  const viewWritesRef = useRef(0);
  const viewWriteWaitersRef = useRef<(() => void)[]>([]);
  const beginViewWrite = useCallback(() => {
    viewWritesRef.current += 1;
  }, []);
  const endViewWrite = useCallback(() => {
    viewWritesRef.current = Math.max(0, viewWritesRef.current - 1);
    if (viewWritesRef.current === 0) {
      const waiters = viewWriteWaitersRef.current;
      viewWriteWaitersRef.current = [];
      for (const resolve of waiters) resolve();
    }
  }, []);
  const waitForViewWrites = useCallback(() => {
    if (viewWritesRef.current === 0) return Promise.resolve();
    const { promise, resolve } = Promise.withResolvers<void>();
    viewWriteWaitersRef.current.push(resolve);
    return promise;
  }, []);

  // The name as the user typed it in edit mode, or `null` while they have not: the header otherwise shows the
  // dashboard's current name, so a rename made elsewhere shows on refetch and is never saved back over.
  const [draftName, setDraftName] = useState<string | null>(null);
  const name = draftName ?? dashboard.name;
  const [draftWidgets, setDraftWidgets] = useState<TDashboardWidget[] | null>(null);
  const [draftPages, setDraftPages] = useState<TDashboardPage[] | null>(null);

  const widgets = draftWidgets ?? dashboard.widgets;
  const pages = draftPages ?? dashboard.pages;
  const datasetIds = useMemo(
    () => widgets.flatMap((widget) => (widget.kind === "chart" ? [widget.chart.feedbackDirectoryId] : [])),
    [widgets]
  );

  // ── The selected page, kept in the URL ────────────────────────────────────────────────────────
  const selectedPageId = resolveSelectedPageId(pages, searchParams.get(PAGE_PARAM));
  const selectPage = useCallback(
    (pageId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(PAGE_PARAM, pageId);
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
    },
    [pathname, searchParams]
  );

  const pageWidgets = useMemo(
    () => widgets.filter((widget) => widget.pageId === selectedPageId),
    [widgets, selectedPageId]
  );

  // ── Auto-height of image and text blocks ─────────────────────────────────────────────────────
  // Each block reports the pixels its content needs; that becomes the fewest grid rows it takes
  // (`fitBlockHeights`). Drawn always, saved with the edit.
  const [neededRows, setNeededRows] = useState<ReadonlyMap<string, number>>(new Map());
  const handleMeasure = useCallback((widgetId: string, px: number) => {
    const rows = pixelsToGridRows(px, ROW_HEIGHT, GRID_MARGIN);
    setNeededRows((current) => {
      if (current.get(widgetId) === rows) return current;
      const next = new Map(current);
      next.set(widgetId, rows);
      return next;
    });
  }, []);
  // An image block without a file is a placeholder for editors; viewers don't get an empty strip for it.
  const displayedWidgets = useMemo(
    () =>
      fitBlockHeights(
        isEditing ? pageWidgets : pageWidgets.filter((widget) => !isEmptyImageBlock(widget)),
        neededRows
      ),
    [pageWidgets, neededRows, isEditing]
  );
  /** Every widget with the heights its blocks are drawn at, as the save sends them. */
  const withFittedHeights = useCallback(
    (all: TDashboardWidget[]) => {
      return fitBlockHeights(all, neededRows);
    },
    [neededRows]
  );

  const hasChanges = useMemo(() => {
    if (draftName !== null && draftName !== dashboard.name) return true;
    if (draftPages && pagesChanged(draftPages, dashboard.pages)) return true;
    if (!draftWidgets) return false;
    return widgetsChanged(draftWidgets, dashboard.widgets);
  }, [draftName, draftPages, draftWidgets, dashboard]);

  const layout = useMemo(() => widgetsToLayout(displayedWidgets, neededRows), [displayedWidgets, neededRows]);

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

  const handleBlockContentChange = useCallback(
    (widgetId: string, content: TDashboardImageContent | TDashboardTextContent) => {
      setDraftWidgets((current) =>
        (current ?? dashboard.widgets).map((widget) =>
          widget.id === widgetId && (widget.kind === "image" || widget.kind === "text")
            ? ({ ...widget, content } as TDashboardWidget)
            : widget
        )
      );
    },
    [dashboard.widgets]
  );

  const enterEditMode = useCallback(async () => {
    if (isEditing) {
      return;
    }

    // A view-mode write (duplicate, remove, undo) moves the dashboard's version on the server. Its
    // read-back was awaited before the write was marked done, so the cache is current once nothing is
    // pending — and the edit base is pinned from there, never from a copy the write has moved past.
    await waitForViewWrites();
    const base = queryClient.getQueryData<TAppDashboard>(dashboardKeys.detail(dashboard.id)) ?? dashboard;
    setDraftWidgets(base.widgets);
    setDraftPages(base.pages);
    setEditBasePages(base.pages);
    setEditBaseWidgetIds(new Set(base.widgets.map((widget) => widget.id)));
    setEditBaseUpdatedAt(base.updatedAt);
    setIsEditing(true);
  }, [dashboard, isEditing, queryClient, waitForViewWrites]);

  const handleEnterEditMode = useCallback(() => {
    void enterEditMode();
  }, [enterEditMode]);

  const handleEditChart = useCallback((chartId: string) => {
    setEditingChartId(chartId);
  }, []);

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

      const snapshot = (draftWidgets ?? dashboard.widgets).find((w) => w.id === widgetId);
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
      draftWidgets,
      dashboard.widgets,
      dashboard.id,
      endViewWrite,
      handleRemoveWidget,
      handleUndoRemoveWidget,
      isEditing,
      refreshDashboard,
      t,
    ]
  );

  const leaveEditMode = useCallback(() => {
    setDraftName(null);
    setDraftWidgets(null);
    setDraftPages(null);
    setEditBasePages(null);
    setEditBaseUpdatedAt(null);
    setEditBaseWidgetIds(null);
    setIsManagePagesOpen(false);
    setIsEditing(false);
  }, []);

  const handleCancel = leaveEditMode;

  // ── Pages and blocks in the draft ─────────────────────────────────────────────────────────────
  const handleAddPage = useCallback(() => {
    if (pages.length >= MAX_DASHBOARD_PAGES) {
      toast.error(t("workspace.analysis.dashboards.page_limit_reached", { max: MAX_DASHBOARD_PAGES }));
      return;
    }
    const added = addDraftPage(
      pages,
      t("workspace.analysis.dashboards.new_page_name", { number: pages.length + 1 })
    );
    setDraftPages(added.pages);
    selectPage(added.pageId);
  }, [pages, selectPage, t]);

  const handleRenamePage = useCallback(
    (pageId: string, pageName: string) => setDraftPages(renameDraftPage(pages, pageId, pageName)),
    [pages]
  );

  const handleMovePage = useCallback(
    (activeId: string, overId: string) => setDraftPages(moveDraftPage(pages, activeId, overId)),
    [pages]
  );

  const handlePageTeamsChange = useCallback(
    (pageId: string, teamIds: string[]) => setDraftPages(setDraftPageTeams(pages, pageId, teamIds)),
    [pages]
  );

  /** Delete asks first; Cancel goes back to where it was asked, the tabs or Manage pages. */
  const askDeletePage = useCallback(
    (pageId: string) => {
      setPageToDelete(pages.find((page) => page.id === pageId) ?? null);
      setIsDeletePageOpen(true);
    },
    [pages]
  );

  const handleConfirmDeletePage = useCallback(() => {
    if (!pageToDelete) return;
    const next = deleteDraftPage(pages, widgets, pageToDelete.id);
    setDraftPages(next.pages);
    setDraftWidgets(next.widgets);
    setIsDeletePageOpen(false);
  }, [pageToDelete, pages, widgets]);

  const handleAddBlock = useCallback(
    (kind: TLayoutBlockKind) => {
      if (!selectedPageId) return;
      setDraftWidgets(
        addDraftBlock(widgets, { kind, pageId: selectedPageId, dashboardId: dashboard.id }).widgets
      );
    },
    [dashboard.id, selectedPageId, widgets]
  );

  const handlePickCharts = useCallback(
    (charts: TAppChart[]) => {
      if (!selectedPageId) return;
      setDraftWidgets(addDraftCharts(widgets, { charts, pageId: selectedPageId, dashboardId: dashboard.id }));
    },
    [dashboard.id, selectedPageId, widgets]
  );

  const placedChartIds = useMemo(
    () => new Set(pageWidgets.flatMap((widget) => (widget.chartId ? [widget.chartId] : []))),
    [pageWidgets]
  );

  // Whether this person may limit pages to teams comes from the server, with the teams it may pick.
  const pageAccess = useQuery({
    queryKey: dashboardKeys.pageAccess(dashboard.id),
    queryFn: ({ signal }) => getDashboardPageAccess(dashboard.id, signal),
    enabled: isEditing && isManagePagesOpen,
  });

  /**
   * One call saves the name, the pages and every widget's page, place and content, carrying the
   * `updatedAt` the edit started from. If the dashboard changed since, nothing is saved and the editor
   * chooses between the latest version and their own.
   */
  const saveDashboard = useCallback(
    async (
      baseUpdatedAt: string,
      savedName: string,
      savedPages: TDashboardPage[],
      basePages: TDashboardPage[],
      savedWidgets: TDashboardWidget[]
    ) => {
      setIsSaving(true);
      try {
        const saved = await replaceDashboard(dashboard.id, {
          name: savedName.trim(),
          expectedUpdatedAt: baseUpdatedAt,
          ...(pagesChanged(savedPages, basePages) ? { pages: toSavedPages(savedPages, basePages) } : {}),
          widgets: toSavedWidgets(withFittedHeights(savedWidgets)),
        });
        queryClient.setQueryData(dashboardKeys.detail(dashboard.id), saved);
        void queryClient.invalidateQueries({ queryKey: dashboardKeys.lists() });
        void queryClient.invalidateQueries({ queryKey: chartKeys.lists() });
        // A page created by the save had a draft id: stay on it, now under its real one.
        if (selectedPageId && isDraftId(selectedPageId)) {
          const index = savedPages.findIndex((page) => page.id === selectedPageId);
          const created = saved.pages[index];
          if (created) selectPage(created.id);
        }
        toast.success(t("workspace.analysis.dashboards.dashboard_saved"));
        setStaleLatest(null);
        leaveEditMode();
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
    [dashboard.id, leaveEditMode, queryClient, selectPage, selectedPageId, t, withFittedHeights]
  );

  /** Whether the draft can be saved; says why not when it cannot. */
  const canSave = useCallback((): boolean => {
    if (!name.trim()) {
      toast.error(t("workspace.analysis.dashboards.dashboard_name_required"));
      return false;
    }
    const emptyText = findEmptyTextBlocks(widgets)[0];
    if (emptyText) {
      selectPage(emptyText.pageId);
      toast.error(t("workspace.analysis.dashboards.text_block_empty"));
      return false;
    }
    return true;
  }, [name, selectPage, t, widgets]);

  const handleSave = useCallback(async () => {
    if (!canSave()) return;
    await saveDashboard(
      editBaseUpdatedAt ?? dashboard.updatedAt,
      name,
      pages,
      editBasePages ?? dashboard.pages,
      widgets
    );
  }, [canSave, saveDashboard, editBaseUpdatedAt, dashboard, name, pages, editBasePages, widgets]);

  /** Discard the edit and show the dashboard as it now is. */
  const handleReloadLatest = useCallback(() => {
    if (!staleLatest) return;
    queryClient.setQueryData(dashboardKeys.detail(dashboard.id), staleLatest);
    setStaleLatest(null);
    leaveEditMode();
    void refreshDashboard();
  }, [staleLatest, queryClient, dashboard.id, leaveEditMode, refreshDashboard]);

  /** Save the edit over the latest version, knowing what it removes. */
  const handleSaveAnyway = useCallback(() => {
    if (!staleLatest) return;
    const keptPages = draftPagesOverLatest(staleLatest.pages, pages);
    // A name this editor did not touch is the latest one, so someone else's rename survives the overwrite.
    void saveDashboard(
      staleLatest.updatedAt,
      draftName ?? staleLatest.name,
      keptPages,
      staleLatest.pages,
      draftOverLatest(staleLatest.widgets, widgets, keptPages)
    );
  }, [staleLatest, saveDashboard, draftName, pages, widgets]);

  const removedByOverwrite = useMemo(
    () =>
      staleLatest
        ? widgetsRemovedByOverwrite(staleLatest.widgets, widgets, editBaseWidgetIds ?? NO_WIDGET_IDS).flatMap(
            (widget) => (widget.kind === "chart" ? [widget.chart.name] : [])
          )
        : [],
    [staleLatest, widgets, editBaseWidgetIds]
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

  // Remember the filters (cookie) for the next visit, then pin them in the URL so the view can be shared.
  const handleFiltersChange = useCallback(
    (next: TDashboardFilterState[]) => {
      const kept = keepValidFilters(next);
      if (kept.length >= MAX_DASHBOARD_FILTERS && next.length > MAX_DASHBOARD_FILTERS) {
        toast.error(t("workspace.analysis.dashboards.filter_limit_reached", { max: MAX_DASHBOARD_FILTERS }));
        return;
      }
      // The filters travel in every chart read's URL, so their values are bounded as the API bounds them.
      if (exceedsFiltersBudget(kept)) {
        toast.error(t("workspace.analysis.dashboards.filter_picks_too_long"));
        return;
      }
      writeStoredFilters(dashboard.id, kept);
      setChosenFilters(kept);
      const params = writeFiltersToUrl(new URLSearchParams(searchParams.toString()), kept);
      const queryString = params.toString();
      window.history.pushState(null, "", queryString ? `${pathname}?${queryString}` : pathname);
    },
    [dashboard.id, pathname, searchParams, t]
  );

  const toolbar = useDashboardToolbarFilters({
    dashboardId: dashboard.id,
    datasetIds,
    filters,
    dateRange,
    onFiltersChange: handleFiltersChange,
  });

  const lockedFilters = useLockedDashboardFilters({
    dashboard,
    personalFilters: filters,
    fieldLabel: toolbar.fieldLabel,
    onPersonalFiltersChange: handleFiltersChange,
    canEdit: !isReadOnly,
    beginWrite: beginViewWrite,
    endWrite: endViewWrite,
  });

  // The filter bar acts on the dashboard's charts, on every page; the grid shows the selected page.
  const hasCharts = datasetIds.length > 0;
  // A Dashboard Viewer's data access (ENG-7372, ENG-7478): their conditions as chips locked for them, or,
  // when their attributes match nothing, no charts at all.
  const viewerAccess = dashboard.viewerAccess;
  const isUnmatched = viewerAccess?.status === "unmatched";
  const toolbarLocked = useMemo(() => {
    const forYou = (viewerAccess?.chips ?? []).map((chip) => ({
      label: chip.label,
      value: chip.values.length > 0 ? chip.values.join(", ") : "—",
      hint: t("workspace.analysis.dashboards.locked_for_you_hint", { attribute: chip.attributeLabel }),
    }));
    if (forYou.length === 0) return lockedFilters.locked;
    return { ...(lockedFilters.locked ?? { filters: [], hint: "" }), forYou };
  }, [viewerAccess?.chips, lockedFilters.locked, t]);
  const isPageEmpty = pageWidgets.length === 0;

  // The cookie is read by the server and seeds `chosenDateFilter`, so there is no client-side restore
  // effect. A pinned URL param still wins and is intentionally NOT written back to the cookie, so
  // opening a shared link never overwrites the viewer's own saved preference.

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
          dashboardId={dashboard.id}
          widget={widget}
          isEditing={isEditing}
          onContentChange={handleBlockContentChange}
          onRemove={handleRemoveWidget}
          onMeasure={isAutoHeightBlock(widget.kind) ? handleMeasure : undefined}
        />
      );
    }
    return (
      <MemoizedWidgetItem
        widget={widget}
        isEditing={isEditing}
        dateRange={dateRange}
        filters={filters}
        filterFieldLabel={toolbar.fieldLabel}
        onEdit={isReadOnly ? undefined : () => handleEditChart(widget.chartId)}
        // Duplicate is hidden in edit mode: it writes to the server at once, and the edit's save would then
        // be refused as stale. In edit mode, add the chart again from Add instead.
        onDuplicate={isReadOnly || isEditing ? undefined : () => handleDuplicateWidget(widget)}
        onResize={isReadOnly ? undefined : handleEnterEditMode}
        onRemove={isReadOnly ? undefined : () => handleRemoveWidgetFromMenu(widget.id)}
      />
    );
  };

  return (
    <PageContentWrapper>
      <GoBackButton url={`/workspaces/${workspaceId}/dashboards`} />
      {viewAsMember && <ViewAsBanner member={viewAsMember} />}
      <DashboardPageHeader
        name={name}
        isEditing={isEditing}
        onNameChange={setDraftName}
        cta={
          <div className="flex items-center gap-2">
            {canManageAccess && !viewAsMember && !isEditing && (
              <>
                <ViewAsButton dashboardId={dashboard.id} />
                <AccessButton dashboardId={dashboard.id} />
              </>
            )}
            <DashboardControlBar
              workspaceId={workspaceId}
              dashboardId={dashboard.id}
              isEditing={isEditing}
              isSaving={isSaving}
              hasChanges={hasChanges}
              isReadOnly={isReadOnly}
              onRefresh={() => {
                void refreshDashboard();
                void queryClient.invalidateQueries({ queryKey: chartKeys.allData() });
              }}
              onAddChart={() => setIsAddChartsOpen(true)}
              onAddBlock={handleAddBlock}
              editHotkey={EDIT_HOTKEY}
              onEditToggle={handleEnterEditMode}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        }
      />

      <DashboardPageTabs
        pages={pages}
        selectedPageId={selectedPageId}
        onSelect={selectPage}
        isEditing={isEditing}
        onAddPage={handleAddPage}
        onRenamePage={handleRenamePage}
        onDeletePage={askDeletePage}
        onManagePages={() => setIsManagePagesOpen(true)}
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

      {/* The filters and the date range only act on existing charts, so the bar is hidden on a dashboard
          without any, and while editing, where the layout is what changes. The same table toolbar the
          responses page has: the filters an editor locked for everyone first, then this person's own, with
          the date range — always this person's own — beside the Filter button. */}
      {!isEditing && hasCharts && !isUnmatched && (
        <TableToolbar
          filter={{
            properties: toolbar.properties,
            filters: toolbar.filters,
            onFiltersChange: toolbar.setFilters,
            locked: toolbarLocked,
            simpleRules: true,
          }}
          controls={<DashboardDateFilter value={dateFilter} onChange={handleDateFilterChange} />}
          actions={
            <>
              {lockedFilters.canLock && (
                <LockFiltersButton
                  mode="lock"
                  isSaving={lockedFilters.isSaving}
                  onClick={() => void lockedFilters.lockPersonalFilters()}
                />
              )}
              {lockedFilters.canUnlockAll && (
                <LockFiltersButton
                  mode="unlock"
                  isSaving={lockedFilters.isSaving}
                  onClick={() => void lockedFilters.unlockAllFilters()}
                />
              )}
            </>
          }
        />
      )}

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
                    {displayedWidgets.map((widget) => (
                      <div key={widget.id}>{renderWidget(widget)}</div>
                    ))}
                  </ResponsiveGridLayout>
                ))}
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
            void refreshDashboard();
            void queryClient.invalidateQueries({ queryKey: chartKeys.allData() });
          }}
          directories={directories}
        />
      )}
      {!isReadOnly && isEditing && (
        <>
          <AddExistingChartsDialog
            open={isAddChartsOpen}
            onOpenChange={setIsAddChartsOpen}
            workspaceId={workspaceId}
            placedChartIds={placedChartIds}
            directories={directories}
            onPick={handlePickCharts}
            isAIAvailable={isAIAvailable}
            aiUnavailableReason={aiUnavailableReason}
          />
          <ManagePagesDialog
            open={isManagePagesOpen}
            onOpenChange={setIsManagePagesOpen}
            pages={pages}
            onAddPage={handleAddPage}
            onRenamePage={handleRenamePage}
            onMovePage={handleMovePage}
            onDeletePage={askDeletePage}
            onTeamsChange={handlePageTeamsChange}
            access={pageAccess.data}
          />
          <ConfirmationModal
            open={isDeletePageOpen}
            setOpen={setIsDeletePageOpen}
            title={t("workspace.analysis.dashboards.delete_page_title")}
            body={t("workspace.analysis.dashboards.delete_page_confirmation", {
              name: pageToDelete?.name ?? "",
            })}
            buttonText={t("common.delete")}
            cancelButtonText={t("common.cancel")}
            onConfirm={handleConfirmDeletePage}
          />
        </>
      )}
    </PageContentWrapper>
  );
}
