"use client";

import { type Dispatch, type RefObject, type SetStateAction, useCallback, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TAppChart } from "@/modules/ee/analysis/lib/api-client";
import type { TDashboardPage, TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import {
  addDraftBlock,
  addDraftCharts,
  addDraftPage,
  deleteDraftPage,
  moveDraftPage,
  renameDraftPage,
  setDraftPageTeams,
} from "../lib/dashboard-draft";
import { MAX_DASHBOARD_PAGES } from "../lib/page-names";
import type { TLayoutBlockKind } from "../lib/widget-blocks";

/** Pages, blocks and picked charts in the edit's draft. Nothing changes while a save is in flight. */
export const useDashboardDraftPages = ({
  dashboardId,
  pages,
  widgets,
  selectedPageId,
  selectPage,
  pagesRef,
  savingRef,
  setDraftPages,
  setDraftWidgets,
}: Readonly<{
  dashboardId: string;
  pages: TDashboardPage[];
  widgets: TDashboardWidget[];
  selectedPageId: string | null;
  selectPage: (pageId: string) => void;
  /** The pages as they are now, for work that finishes after the render that started it. */
  pagesRef: RefObject<TDashboardPage[]>;
  savingRef: RefObject<boolean>;
  setDraftPages: Dispatch<SetStateAction<TDashboardPage[] | null>>;
  setDraftWidgets: Dispatch<SetStateAction<TDashboardWidget[] | null>>;
}>) => {
  const { t } = useTranslation();
  const [pageToDelete, setPageToDelete] = useState<TDashboardPage | null>(null);
  const [isDeletePageOpen, setIsDeletePageOpen] = useState(false);

  const handleAddPage = useCallback(() => {
    if (savingRef.current) return;
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
  }, [pages, savingRef, selectPage, setDraftPages, t]);

  const handleRenamePage = useCallback(
    (pageId: string, pageName: string) => {
      if (!savingRef.current) setDraftPages(renameDraftPage(pages, pageId, pageName));
    },
    [pages, savingRef, setDraftPages]
  );

  const handleMovePage = useCallback(
    (activeId: string, overId: string) => {
      if (!savingRef.current) setDraftPages(moveDraftPage(pages, activeId, overId));
    },
    [pages, savingRef, setDraftPages]
  );

  const handlePageTeamsChange = useCallback(
    (pageId: string, teamIds: string[] | null) => {
      if (!savingRef.current) setDraftPages(setDraftPageTeams(pages, pageId, teamIds));
    },
    [pages, savingRef, setDraftPages]
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
    if (!pageToDelete || savingRef.current) return;
    const next = deleteDraftPage(pages, widgets, pageToDelete.id);
    setDraftPages(next.pages);
    setDraftWidgets(next.widgets);
    setIsDeletePageOpen(false);
  }, [pageToDelete, pages, savingRef, setDraftPages, setDraftWidgets, widgets]);

  const handleAddBlock = useCallback(
    (kind: TLayoutBlockKind) => {
      if (!selectedPageId || savingRef.current) return;
      setDraftWidgets(addDraftBlock(widgets, { kind, pageId: selectedPageId, dashboardId }).widgets);
    },
    [dashboardId, savingRef, selectedPageId, setDraftWidgets, widgets]
  );

  // A chart created from the picker arrives after a read, so it is added to the draft as it is then, on
  // the page the picker was opened on, and not at all once that page or the edit is gone.
  const handlePickCharts = useCallback(
    (charts: TAppChart[]) => {
      const pageId = selectedPageId;
      if (!pageId || savingRef.current) return;
      if (!pagesRef.current.some((page) => page.id === pageId)) return;
      setDraftWidgets((current) =>
        current === null ? current : addDraftCharts(current, { charts, pageId, dashboardId })
      );
    },
    [dashboardId, pagesRef, savingRef, selectedPageId, setDraftWidgets]
  );

  return {
    handleAddPage,
    handleRenamePage,
    handleMovePage,
    handlePageTeamsChange,
    pageToDelete,
    isDeletePageOpen,
    setIsDeletePageOpen,
    askDeletePage,
    handleConfirmDeletePage,
    handleAddBlock,
    handlePickCharts,
  };
};
