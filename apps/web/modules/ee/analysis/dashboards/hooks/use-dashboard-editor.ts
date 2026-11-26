"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Layout } from "react-grid-layout";
import type { TDashboardImageContent, TDashboardTextContent } from "@formbricks/types/analysis";
import { type TAppDashboard, getDashboardPageAccess } from "@/modules/ee/analysis/lib/api-client";
import { dashboardKeys } from "@/modules/ee/analysis/lib/query";
import type { TDashboardPage, TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { pagesChanged, widgetsChanged } from "../lib/dashboard-draft";
import { applyLayoutToWidgets } from "../lib/dashboard-grid-layout";
import { useDashboardDraftPages } from "./use-dashboard-draft-pages";
import { useDashboardPageSelection } from "./use-dashboard-page-selection";
import { useDashboardSave } from "./use-dashboard-save";
import { useImageUploads } from "./use-image-uploads";

/**
 * The edit session: the draft of the name, pages and widgets the editor changes, the version it started
 * from, and saving it. Outside edit mode there is no draft, and the dashboard shows as it was last read.
 */
export const useDashboardEditor = ({
  dashboard,
  refreshDashboard,
  waitForViewWrites,
  withFittedHeights,
}: Readonly<{
  dashboard: TAppDashboard;
  /** After a write, read the dashboard again — and the lists that count its widgets. */
  refreshDashboard: () => Promise<void>;
  /** Resolves once no view-mode write (duplicate, remove, undo) is in flight. */
  waitForViewWrites: () => Promise<void>;
  withFittedHeights: (all: TDashboardWidget[]) => TDashboardWidget[];
}>) => {
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Set as a save starts, before React re-renders: the draft is frozen while its request is in flight, so
  // nothing changed meanwhile is cleared unsaved when the save succeeds.
  const savingRef = useRef(false);
  // The edit session open now (`null` when not editing): an image upload's file goes into the draft only
  // if its session is still open.
  const editSessionRef = useRef<number | null>(null);
  const lastEditSessionRef = useRef(0);
  // The version the edit started from: what the save sends as its precondition, so a refetch while
  // editing can never make a save silently overwrite someone else's change.
  const [editBaseUpdatedAt, setEditBaseUpdatedAt] = useState<string | null>(null);
  // The widgets the edit started with. The stale warning lists what a whole-dashboard save removes that
  // the editor never removed itself; without this, their own removals read as "added meanwhile".
  const [editBaseWidgetIds, setEditBaseWidgetIds] = useState<ReadonlySet<string> | null>(null);
  // The pages the edit started with: a save sends a page's team limit only where it changed from these.
  const [editBasePages, setEditBasePages] = useState<TDashboardPage[] | null>(null);
  const [isManagePagesOpen, setIsManagePagesOpen] = useState(false);

  // The name as the user typed it in edit mode, or `null` while they have not: the header otherwise shows the
  // dashboard's current name, so a rename made elsewhere shows on refetch and is never saved back over.
  const [draftName, setDraftName] = useState<string | null>(null);
  const name = draftName ?? dashboard.name;
  const [draftWidgets, setDraftWidgets] = useState<TDashboardWidget[] | null>(null);
  const [draftPages, setDraftPages] = useState<TDashboardPage[] | null>(null);

  const widgets = draftWidgets ?? dashboard.widgets;
  const pages = draftPages ?? dashboard.pages;

  const { selectedPageId, selectPage, selectedPageIdRef, pagesRef } = useDashboardPageSelection(pages);

  const pageWidgets = useMemo(
    () => widgets.filter((widget) => widget.pageId === selectedPageId),
    [widgets, selectedPageId]
  );

  const hasChanges = useMemo(() => {
    if (draftName !== null && draftName !== dashboard.name) return true;
    if (draftPages && pagesChanged(draftPages, dashboard.pages)) return true;
    if (!draftWidgets) return false;
    return widgetsChanged(draftWidgets, dashboard.widgets);
  }, [draftName, draftPages, draftWidgets, dashboard]);

  const uploads = useImageUploads({ savingRef, editSessionRef, setDraftWidgets });

  const handleInteractionEnd = useCallback(
    (finalLayout: Layout) => {
      if (savingRef.current) return;
      setDraftWidgets((current) => applyLayoutToWidgets(current ?? dashboard.widgets, finalLayout));
    },
    [dashboard.widgets]
  );

  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      if (savingRef.current) return;
      setDraftWidgets((current) => (current ?? dashboard.widgets).filter((w) => w.id !== widgetId));
    },
    [dashboard.widgets]
  );

  const handleBlockContentChange = useCallback(
    (widgetId: string, content: TDashboardImageContent | TDashboardTextContent) => {
      if (savingRef.current) return;
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
    lastEditSessionRef.current += 1;
    editSessionRef.current = lastEditSessionRef.current;
    setIsEditing(true);
  }, [dashboard, isEditing, queryClient, waitForViewWrites]);

  const handleEnterEditMode = useCallback(() => {
    void enterEditMode();
  }, [enterEditMode]);

  const leaveEditMode = useCallback(() => {
    editSessionRef.current = null;
    setDraftName(null);
    setDraftWidgets(null);
    setDraftPages(null);
    setEditBasePages(null);
    setEditBaseUpdatedAt(null);
    setEditBaseWidgetIds(null);
    setIsManagePagesOpen(false);
    setIsEditing(false);
  }, []);

  const handleNameChange = useCallback((nextName: string) => {
    if (!savingRef.current) setDraftName(nextName);
  }, []);

  const draftPagesActions = useDashboardDraftPages({
    dashboardId: dashboard.id,
    pages,
    widgets,
    selectedPageId,
    selectPage,
    pagesRef,
    savingRef,
    setDraftPages,
    setDraftWidgets,
  });

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

  const save = useDashboardSave({
    dashboard,
    savingRef,
    setIsSaving,
    uploadsRef: uploads.uploadsRef,
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
  });

  return {
    isEditing,
    isSaving,
    isUploading: uploads.isUploading,
    hasChanges,
    name,
    pages,
    widgets,
    pageWidgets,
    selectedPageId,
    selectPage,
    placedChartIds,
    pageAccess: pageAccess.data,
    isManagePagesOpen,
    setIsManagePagesOpen,
    handleEnterEditMode,
    handleCancel: leaveEditMode,
    handleNameChange,
    handleInteractionEnd,
    handleRemoveWidget,
    handleBlockContentChange,
    handleImageUploadStart: uploads.handleImageUploadStart,
    handleImageUploadEnd: uploads.handleImageUploadEnd,
    ...draftPagesActions,
    ...save,
  };
};
