"use client";

import { useTranslation } from "react-i18next";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { AddExistingChartsDialog } from "@/modules/ee/analysis/dashboards/components/add-existing-charts-dialog";
import { ManagePagesDialog } from "@/modules/ee/analysis/dashboards/components/manage-pages-dialog";
import type { useDashboardEditor } from "@/modules/ee/analysis/dashboards/hooks/use-dashboard-editor";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";

/** The dialogs only edit mode opens: add charts, manage pages, and confirm a page's deletion. */
export function DashboardEditDialogs({
  editor,
  workspaceId,
  directories,
  isAddChartsOpen,
  onAddChartsOpenChange,
  isAIAvailable,
  aiUnavailableReason,
}: Readonly<{
  editor: ReturnType<typeof useDashboardEditor>;
  workspaceId: string;
  directories: { id: string; name: string }[];
  isAddChartsOpen: boolean;
  onAddChartsOpenChange: (open: boolean) => void;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
}>) {
  const { t } = useTranslation();

  return (
    <>
      <AddExistingChartsDialog
        open={isAddChartsOpen}
        onOpenChange={onAddChartsOpenChange}
        workspaceId={workspaceId}
        placedChartIds={editor.placedChartIds}
        directories={directories}
        onPick={editor.handlePickCharts}
        isAIAvailable={isAIAvailable}
        aiUnavailableReason={aiUnavailableReason}
      />
      <ManagePagesDialog
        open={editor.isManagePagesOpen}
        onOpenChange={editor.setIsManagePagesOpen}
        pages={editor.pages}
        onAddPage={editor.handleAddPage}
        onRenamePage={editor.handleRenamePage}
        onMovePage={editor.handleMovePage}
        onDeletePage={editor.askDeletePage}
        onTeamsChange={editor.handlePageTeamsChange}
        access={editor.pageAccess}
      />
      <ConfirmationModal
        open={editor.isDeletePageOpen}
        setOpen={editor.setIsDeletePageOpen}
        title={t("workspace.analysis.dashboards.delete_page_title")}
        body={t("workspace.analysis.dashboards.delete_page_confirmation", {
          name: editor.pageToDelete?.name ?? "",
        })}
        buttonText={t("common.delete")}
        cancelButtonText={t("common.cancel")}
        onConfirm={editor.handleConfirmDeletePage}
      />
    </>
  );
}
