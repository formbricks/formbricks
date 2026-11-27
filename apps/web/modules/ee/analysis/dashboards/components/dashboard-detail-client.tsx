"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { CreateChartDialog } from "@/modules/ee/analysis/charts/components/create-chart-dialog";
import { ListLoadError } from "@/modules/ee/analysis/components/list-load-error";
import {
  AccessButton,
  type TViewAsMember,
  ViewAsBanner,
  ViewAsButton,
} from "@/modules/ee/analysis/dashboards/components/dashboard-access-controls";
import { DashboardControlBar } from "@/modules/ee/analysis/dashboards/components/dashboard-control-bar";
import { DashboardEditDialogs } from "@/modules/ee/analysis/dashboards/components/dashboard-edit-dialogs";
import { DashboardFilterToolbar } from "@/modules/ee/analysis/dashboards/components/dashboard-filter-toolbar";
import { DashboardGrid } from "@/modules/ee/analysis/dashboards/components/dashboard-grid";
import { DashboardPageHeader } from "@/modules/ee/analysis/dashboards/components/dashboard-page-header";
import { DashboardPageTabs } from "@/modules/ee/analysis/dashboards/components/dashboard-page-tabs";
import { DashboardWidgetSkeleton } from "@/modules/ee/analysis/dashboards/components/dashboard-widget-skeleton";
import { StaleDashboardDialog } from "@/modules/ee/analysis/dashboards/components/stale-dashboard-dialog";
import type { TDashboardDateFilter } from "@/modules/ee/analysis/dashboards/lib/dashboard-date-filter";
import type { TDashboardFilterState } from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-state";
import { EDIT_HOTKEY } from "@/modules/ee/analysis/dashboards/lib/edit-hotkey";
import type { TAppDashboard } from "@/modules/ee/analysis/lib/api-client";
import { chartKeys, dashboardKeys } from "@/modules/ee/analysis/lib/query";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { useBlockHeights } from "../hooks/use-block-heights";
import { useDashboard } from "../hooks/use-dashboard";
import { useDashboardEditor } from "../hooks/use-dashboard-editor";
import { useDashboardToolbarFilters } from "../hooks/use-dashboard-toolbar-filters";
import { useDashboardViewFilters } from "../hooks/use-dashboard-view-filters";
import { useDashboardViewModeWrites } from "../hooks/use-dashboard-view-mode-writes";
import { useDashboardViewerAccessMatch } from "../hooks/use-dashboard-viewer-access-match";
import { useEditHotkey } from "../hooks/use-edit-hotkey";
import { useLockedDashboardFilters } from "../hooks/use-locked-dashboard-filters";
import { useViewWrites } from "../hooks/use-view-writes";

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
  // A 403 is the exception: access was taken away, so the copy read before must not stay on screen.
  const isForbidden = error instanceof V3ApiError && error.status === 403;
  if (!dashboard || isForbidden) {
    return (
      <PageContentWrapper>
        <GoBackButton url={`/workspaces/${props.workspaceId}/dashboards`} />
        {/* Viewing as someone keeps the banner and its way back, whatever the read answered. */}
        {props.viewAsMember && <ViewAsBanner member={props.viewAsMember} />}
        {/* A 403 while viewing as someone is the answer, not a failure: they cannot see this dashboard. */}
        {props.viewAsMember && isForbidden ? (
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
  const queryClient = useQueryClient();
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [isAddChartsOpen, setIsAddChartsOpen] = useState(false);

  const viewFilters = useDashboardViewFilters({
    dashboardId: dashboard.id,
    storedDateFilter,
    storedFilters,
    isViewingAs: viewAsMember !== null,
  });

  /** After a write, read the dashboard again — and the lists that count its widgets. */
  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardKeys.detail(dashboard.id) }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: chartKeys.lists() }),
    ]);
  }, [queryClient, dashboard.id]);
  const refreshCharts = () => {
    void refreshDashboard();
    void queryClient.invalidateQueries({ queryKey: chartKeys.allData() });
  };

  const { beginViewWrite, endViewWrite, waitForViewWrites } = useViewWrites();
  const blockHeights = useBlockHeights();
  const editor = useDashboardEditor({
    dashboard,
    refreshDashboard,
    waitForViewWrites,
    withFittedHeights: blockHeights.withFittedHeights,
  });
  const viewModeWrites = useDashboardViewModeWrites({
    dashboard,
    isEditing: editor.isEditing,
    widgets: editor.widgets,
    handleRemoveWidget: editor.handleRemoveWidget,
    beginViewWrite,
    endViewWrite,
    refreshDashboard,
  });

  useEditHotkey({
    isReadOnly,
    isEditing: editor.isEditing,
    hasChanges: editor.hasChanges,
    isBusy: editor.isSaving || editor.isUploading,
    onEnter: editor.handleEnterEditMode,
    onSave: editor.handleSave,
    onCancel: editor.handleCancel,
  });

  // From the saved widgets, not the draft: the filter fields are read from the saved dashboard, so a draft
  // chart's dataset in the query key would cache the saved fields under a key that claims to include it.
  const datasetIds = useMemo(
    () =>
      dashboard.widgets.flatMap((widget) =>
        widget.kind === "chart" ? [widget.chart.feedbackDirectoryId] : []
      ),
    [dashboard.widgets]
  );

  const toolbar = useDashboardToolbarFilters({
    dashboardId: dashboard.id,
    datasetIds,
    filters: viewFilters.filters,
    dateRange: viewFilters.dateRange,
    onFiltersChange: viewFilters.handleFiltersChange,
  });

  const lockedFilters = useLockedDashboardFilters({
    dashboard,
    personalFilters: viewFilters.filters,
    fieldLabel: toolbar.fieldLabel,
    onPersonalFiltersChange: viewFilters.handleFiltersChange,
    canEdit: !isReadOnly,
    beginWrite: beginViewWrite,
    endWrite: endViewWrite,
  });

  // The filter bar acts on the dashboard's charts, on every page; the grid shows the selected page.
  const hasCharts = datasetIds.length > 0;
  // A Dashboard Viewer whose attributes match nothing sees no charts at all (ENG-7372, ENG-7478). The read
  // answers from conditions alone; the record check runs after the dashboard has drawn.
  const { isUnmatched } = useDashboardViewerAccessMatch({
    dashboardId: dashboard.id,
    status: dashboard.viewerAccess?.status,
  });

  return (
    <PageContentWrapper>
      <GoBackButton url={`/workspaces/${workspaceId}/dashboards`} />
      {viewAsMember && <ViewAsBanner member={viewAsMember} />}
      <DashboardPageHeader
        name={editor.name}
        isEditing={editor.isEditing}
        onNameChange={editor.handleNameChange}
        cta={
          <div className="flex items-center gap-2">
            {canManageAccess && !viewAsMember && !editor.isEditing && (
              <>
                <ViewAsButton dashboardId={dashboard.id} />
                <AccessButton dashboardId={dashboard.id} />
              </>
            )}
            <DashboardControlBar
              workspaceId={workspaceId}
              dashboardId={dashboard.id}
              isEditing={editor.isEditing}
              isSaving={editor.isSaving}
              isUploading={editor.isUploading}
              hasChanges={editor.hasChanges}
              isReadOnly={isReadOnly}
              onRefresh={refreshCharts}
              onAddChart={() => setIsAddChartsOpen(true)}
              onAddBlock={editor.handleAddBlock}
              editHotkey={EDIT_HOTKEY}
              onEditToggle={editor.handleEnterEditMode}
              onSave={editor.handleSave}
              onCancel={editor.handleCancel}
            />
          </div>
        }
      />

      <DashboardPageTabs
        pages={editor.pages}
        selectedPageId={editor.selectedPageId}
        onSelect={editor.selectPage}
        isEditing={editor.isEditing}
        onAddPage={editor.handleAddPage}
        onRenamePage={editor.handleRenamePage}
        onDeletePage={editor.askDeletePage}
        onManagePages={() => editor.setIsManagePagesOpen(true)}
      />

      <StaleDashboardDialog
        open={editor.isStale}
        removedItemNames={editor.removedByOverwrite}
        isSaving={editor.isSaving}
        onReload={editor.handleReloadLatest}
        onSaveAnyway={editor.handleSaveAnyway}
        onOpenChange={(open) => {
          if (!open) editor.dismissStale();
        }}
      />

      {/* The filters and the date range only act on existing charts, so the bar is hidden on a dashboard
          without any, and while editing, where the layout is what changes. */}
      {!editor.isEditing && hasCharts && !isUnmatched && (
        <DashboardFilterToolbar
          toolbar={toolbar}
          lockedFilters={lockedFilters}
          viewerAccess={dashboard.viewerAccess}
          dateFilter={viewFilters.dateFilter}
          onDateFilterChange={viewFilters.handleDateFilterChange}
        />
      )}

      <DashboardGrid
        dashboardId={dashboard.id}
        pageWidgets={editor.pageWidgets}
        neededRows={blockHeights.neededRows}
        isEditing={editor.isEditing}
        isSaving={editor.isSaving}
        isReadOnly={isReadOnly}
        isUnmatched={isUnmatched}
        dateRange={viewFilters.dateRange}
        filters={viewFilters.filters}
        filterFieldLabel={toolbar.fieldLabel}
        onInteractionEnd={editor.handleInteractionEnd}
        onBlockContentChange={editor.handleBlockContentChange}
        onImageUploadStart={editor.handleImageUploadStart}
        onImageUploadEnd={editor.handleImageUploadEnd}
        onRemoveWidget={editor.handleRemoveWidget}
        onMeasure={blockHeights.handleMeasure}
        onEditChart={setEditingChartId}
        onDuplicateWidget={viewModeWrites.handleDuplicateWidget}
        onRemoveWidgetFromMenu={viewModeWrites.handleRemoveWidgetFromMenu}
        onEnterEditMode={editor.handleEnterEditMode}
      />
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
            refreshCharts();
          }}
          directories={directories}
        />
      )}
      {!isReadOnly && editor.isEditing && (
        <DashboardEditDialogs
          editor={editor}
          workspaceId={workspaceId}
          directories={directories}
          isAddChartsOpen={isAddChartsOpen}
          onAddChartsOpenChange={setIsAddChartsOpen}
          isAIAvailable={isAIAvailable}
          aiUnavailableReason={aiUnavailableReason}
        />
      )}
    </PageContentWrapper>
  );
}
