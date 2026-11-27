"use client";

import { useQueryClient } from "@tanstack/react-query";
import { type RefObject, useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  type TAppDashboard,
  getChartApiErrorMessage,
  getDashboard,
  isStaleDashboardError,
  replaceDashboard,
} from "@/modules/ee/analysis/lib/api-client";
import { chartKeys, dashboardKeys } from "@/modules/ee/analysis/lib/query";
import type { TDashboardPage, TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { findEmptyTextBlocks, isDraftId, pagesChanged, toSavedPages } from "../lib/dashboard-draft";
import {
  draftOverLatest,
  draftPagesOverLatest,
  pagesRemovedByOverwrite,
  toSavedWidgets,
  widgetsRemovedByOverwrite,
} from "../lib/stale-save";

const NO_WIDGET_IDS: ReadonlySet<string> = new Set();

/**
 * Saving the edit: one call saves the name, the pages and every widget's page, place and content, carrying
 * the `updatedAt` the edit started from. If the dashboard changed since, nothing is saved and the editor
 * chooses between the latest version and their own.
 */
export const useDashboardSave = ({
  dashboard,
  savingRef,
  setIsSaving,
  uploadsRef,
  name,
  draftName,
  pages,
  widgets,
  editBaseUpdatedAt,
  editBasePages,
  editBaseWidgetIds,
  selectPage,
  selectedPageIdRef,
  leaveEditMode,
  withFittedHeights,
  refreshDashboard,
}: Readonly<{
  dashboard: TAppDashboard;
  /** Set as a save starts, before React re-renders: the draft is frozen while its request is in flight. */
  savingRef: RefObject<boolean>;
  setIsSaving: (isSaving: boolean) => void;
  /** Image uploads in flight: Save waits for them. */
  uploadsRef: RefObject<number>;
  name: string;
  draftName: string | null;
  pages: TDashboardPage[];
  widgets: TDashboardWidget[];
  editBaseUpdatedAt: string | null;
  editBasePages: TDashboardPage[] | null;
  editBaseWidgetIds: ReadonlySet<string> | null;
  selectPage: (pageId: string) => void;
  selectedPageIdRef: RefObject<string | null>;
  leaveEditMode: () => void;
  withFittedHeights: (all: TDashboardWidget[]) => TDashboardWidget[];
  refreshDashboard: () => Promise<void>;
}>) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // Set when a save was refused because the dashboard changed meanwhile: its latest version.
  const [staleLatest, setStaleLatest] = useState<TAppDashboard | null>(null);

  const saveDashboard = useCallback(
    async (
      baseUpdatedAt: string,
      savedName: string,
      savedPages: TDashboardPage[],
      basePages: TDashboardPage[],
      savedWidgets: TDashboardWidget[]
    ) => {
      savingRef.current = true;
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
        // A page created by the save had a draft id: stay on it, now under its real one. Read the selection
        // as it is now, so a page picked while the save was in flight stays picked.
        const currentPageId = selectedPageIdRef.current;
        if (currentPageId && isDraftId(currentPageId)) {
          const index = savedPages.findIndex((page) => page.id === currentPageId);
          const created = index === -1 ? undefined : saved.pages[index];
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
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [
      dashboard.id,
      leaveEditMode,
      queryClient,
      savingRef,
      selectPage,
      selectedPageIdRef,
      setIsSaving,
      t,
      withFittedHeights,
    ]
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
    if (uploadsRef.current > 0 || !canSave()) return;
    await saveDashboard(
      editBaseUpdatedAt ?? dashboard.updatedAt,
      name,
      pages,
      editBasePages ?? dashboard.pages,
      widgets
    );
  }, [canSave, saveDashboard, editBaseUpdatedAt, dashboard, name, pages, editBasePages, uploadsRef, widgets]);

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
    if (!staleLatest || uploadsRef.current > 0) return;
    const keptPages = draftPagesOverLatest(staleLatest.pages, pages, editBasePages ?? []);
    // A name this editor did not touch is the latest one, so someone else's rename survives the overwrite.
    void saveDashboard(
      staleLatest.updatedAt,
      draftName ?? staleLatest.name,
      keptPages,
      staleLatest.pages,
      draftOverLatest(staleLatest.widgets, widgets, keptPages)
    );
  }, [staleLatest, saveDashboard, draftName, pages, editBasePages, uploadsRef, widgets]);

  const dismissStale = useCallback(() => setStaleLatest(null), []);

  // Everything Save anyway takes away that someone else added meanwhile: their pages, then their charts
  // and blocks, each named as the editor would recognise it.
  const removedByOverwrite = useMemo(() => {
    if (!staleLatest) return [];
    const basePageIds = new Set((editBasePages ?? []).map((page) => page.id));
    const removedPages = pagesRemovedByOverwrite(staleLatest.pages, pages, basePageIds).map((page) =>
      t("workspace.analysis.dashboards.stale_removed_page", { name: page.name })
    );
    const removedWidgets = widgetsRemovedByOverwrite(
      staleLatest.widgets,
      widgets,
      editBaseWidgetIds ?? NO_WIDGET_IDS
    ).map((widget) => {
      switch (widget.kind) {
        case "chart":
          return widget.chart.name;
        case "text":
          return widget.content.headline.trim() || t("common.text");
        case "image":
          return widget.content.alt.trim() || t("common.image");
        default:
          return t("workspace.analysis.dashboards.separator");
      }
    });
    return [...removedPages, ...removedWidgets];
  }, [staleLatest, pages, widgets, editBasePages, editBaseWidgetIds, t]);

  return {
    isStale: staleLatest !== null,
    removedByOverwrite,
    handleSave,
    handleReloadLatest,
    handleSaveAnyway,
    dismissStale,
  };
};
