"use client";

import { Table } from "@tanstack/react-table";
import { ArrowDownToLineIcon, Trash2Icon } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TResponseWithQuotas } from "@formbricks/types/responses";
import { cn } from "@/lib/cn";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Alert, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { DecrementQuotasCheckbox } from "@/modules/ui/components/decrement-quotas-checkbox";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { deleteInChunks } from "../lib/delete-in-chunks";

const Separator = () => <div>|</div>;

interface SelectedRowSettingsProps<T> {
  readonly table: Table<T>;
  readonly updateRowList: (rowId: string[]) => void;
  readonly type: "response" | "contact" | "attribute";
  readonly deleteAction: (id: string, params?: Record<string, boolean>) => Promise<void>;
  /** Opens the download for the selected rows (the Export modal, for responses). */
  readonly downloadRowsAction?: (rowIds: string[]) => void;
  readonly isQuotasAllowed: boolean;
  /** Extra actions for the bar, given the table so they can read the selection when clicked. */
  readonly renderExtraActions?: (table: Table<T>) => ReactNode;
  /**
   * Why the rows can't be deleted. Delete then shows as disabled and says why on hover or focus. It is
   * `aria-disabled`, not `disabled`: a disabled button gets no hover or focus, so the reason would never show.
   */
  readonly deleteDisabledReason?: string;
  /** A warning the delete dialog shows above its buttons, e.g. that the rows reach other workspaces too. */
  readonly deleteWarning?: string;
}

/** Deletions in flight at once: enough to be quick, few enough to stay inside the write budget. */
const DELETE_CHUNK_SIZE = 5;

export const SelectedRowSettings = <T,>({
  table,
  updateRowList,
  type,
  deleteAction,
  downloadRowsAction,
  isQuotasAllowed,
  renderExtraActions,
  deleteDisabledReason,
  deleteWarning,
}: SelectedRowSettingsProps<T>) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { t } = useTranslation();
  const selectedRowCount = table.getFilteredSelectedRowModel().rows.length;

  const hasQuotas =
    type === "response" &&
    table
      .getFilteredSelectedRowModel()
      .rows.some((row) => (row.original as TResponseWithQuotas).quotas?.length);

  const [decrementQuotas, setDecrementQuotas] = useState<boolean>(hasQuotas);

  // Toggle all rows selection
  const handleToggleAllRowsSelection = useCallback(
    (selectAll: boolean) => {
      table.toggleAllPageRowsSelected(selectAll);
    },
    [table]
  );

  // Adjusted during render when the selection gains or loses quotas.
  const [syncedHasQuotas, setSyncedHasQuotas] = useState(hasQuotas);
  if (syncedHasQuotas !== hasQuotas) {
    setSyncedHasQuotas(hasQuotas);
    setDecrementQuotas(hasQuotas);
  }

  // Handle deletion
  const handleDelete = async () => {
    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
    const rowsToBeDeleted = table.getFilteredSelectedRowModel().rows.map((row) => row.id);
    try {
      setIsDeleting(true);
      const { deleted, error } = await deleteInChunks(
        rowsToBeDeleted,
        (rowId) => (type === "response" ? deleteAction(rowId, { decrementQuotas }) : deleteAction(rowId)),
        DELETE_CHUNK_SIZE
      );
      // The rows already gone leave the table even when a later one failed.
      if (deleted.length > 0) updateRowList(deleted);
      if (error === undefined) {
        toast.success(t("common.table_items_deleted_successfully", { type: capitalizedType }));
      } else {
        toast.error(
          getV3ApiErrorMessage(
            error,
            t("common.an_unknown_error_occurred_while_deleting_table_items", { type: capitalizedType })
          )
        );
      }
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  // Handle download selected rows
  const handleDownloadSelectedRows = () => {
    const rowsToDownload = table.getFilteredSelectedRowModel().rows.map((row) => row.id);
    if (downloadRowsAction && rowsToDownload.length > 0) {
      downloadRowsAction(rowsToDownload);
    }
  };

  const quotasDialogText = isQuotasAllowed
    ? t("workspace.contacts.delete_contact_confirmation_with_quotas", {
        value: selectedRowCount,
      })
    : t("workspace.contacts.delete_contact_confirmation");

  let deleteDialogText: string;
  if (type === "response") {
    deleteDialogText = t("workspace.surveys.responses.delete_response_confirmation");
  } else if (type === "attribute") {
    deleteDialogText = t("workspace.contacts.delete_attribute_confirmation", { value: selectedRowCount });
  } else {
    deleteDialogText = quotasDialogText;
  }

  let selectedTypeLabel: string;
  if (type === "response") {
    selectedTypeLabel = t("common.responses");
  } else if (type === "contact") {
    selectedTypeLabel = t("common.contacts");
  } else {
    selectedTypeLabel = t("common.attributes");
  }

  let deleteWhatText: string;
  if (type === "response") {
    deleteWhatText = t("common.count_responses", { count: selectedRowCount });
  } else if (type === "contact") {
    deleteWhatText = t("common.count_contacts", { count: selectedRowCount });
  } else {
    deleteWhatText = t("common.count_attributes", { count: selectedRowCount });
  }

  return (
    <>
      <div className="flex items-center gap-x-2 rounded-md bg-primary p-1 px-2 text-xs text-white">
        <div className="lowercase">{`${selectedRowCount} ${selectedTypeLabel} ${t("common.selected")}`}</div>
        <Separator />
        <Button
          variant="outline"
          size="sm"
          className="h-6 border-none px-2"
          onClick={() => handleToggleAllRowsSelection(true)}>
          {t("common.select_all")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 border-none px-2"
          onClick={() => handleToggleAllRowsSelection(false)}>
          {t("common.clear_selection")}
        </Button>
        <Separator />
        {downloadRowsAction && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 gap-1 border-none px-2"
            onClick={handleDownloadSelectedRows}>
            <ArrowDownToLineIcon />
            {t("common.download")}
          </Button>
        )}
        {renderExtraActions?.(table)}
        <TooltipRenderer tooltipContent={deleteDisabledReason} shouldRender={Boolean(deleteDisabledReason)}>
          <Button
            variant="secondary"
            size="sm"
            className={cn("h-6 gap-1 px-2", deleteDisabledReason && "cursor-not-allowed opacity-50")}
            aria-disabled={deleteDisabledReason ? true : undefined}
            onClick={() => {
              if (!deleteDisabledReason) setIsDeleteDialogOpen(true);
            }}>
            {t("common.delete")}
            <Trash2Icon />
          </Button>
        </TooltipRenderer>
      </div>
      <DeleteDialog
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        deleteWhat={deleteWhatText}
        onDelete={handleDelete}
        isDeleting={isDeleting}
        text={deleteDialogText}>
        {deleteWarning ? (
          <Alert variant="warning" alertRole="status">
            <AlertTitle>{deleteWarning}</AlertTitle>
          </Alert>
        ) : null}
        {hasQuotas && (
          <DecrementQuotasCheckbox
            title={t("workspace.surveys.responses.bulk_delete_response_quotas")}
            checked={decrementQuotas ?? hasQuotas}
            onCheckedChange={setDecrementQuotas}
          />
        )}
      </DeleteDialog>
    </>
  );
};
