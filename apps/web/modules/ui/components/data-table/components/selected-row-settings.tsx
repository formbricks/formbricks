"use client";

import { Table } from "@tanstack/react-table";
import { ArrowDownToLineIcon, Trash2Icon } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TResponseWithQuotas } from "@formbricks/types/responses";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { DecrementQuotasCheckbox } from "@/modules/ui/components/decrement-quotas-checkbox";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";

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
}

export const SelectedRowSettings = <T,>({
  table,
  updateRowList,
  type,
  deleteAction,
  downloadRowsAction,
  isQuotasAllowed,
  renderExtraActions,
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

  useEffect(() => {
    setDecrementQuotas(hasQuotas);
  }, [hasQuotas]);

  // Handle deletion
  const handleDelete = async () => {
    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
    const rowsToBeDeleted = table.getFilteredSelectedRowModel().rows.map((row) => row.id);
    // The rows already gone, so a failure part-way still takes them off the table.
    const deleted: string[] = [];
    try {
      setIsDeleting(true);

      const CHUNK_SIZE = 5;
      for (let i = 0; i < rowsToBeDeleted.length; i += CHUNK_SIZE) {
        const chunk = rowsToBeDeleted.slice(i, i + CHUNK_SIZE);
        const results = await Promise.allSettled(
          chunk.map((rowId) =>
            type === "response" ? deleteAction(rowId, { decrementQuotas }) : deleteAction(rowId)
          )
        );
        chunk.forEach((rowId, index) => {
          if (results[index].status === "fulfilled") deleted.push(rowId);
        });
        const failure = results.find((result) => result.status === "rejected");
        if (failure) throw failure.reason;
      }

      updateRowList(deleted);
      toast.success(t("common.table_items_deleted_successfully", { type: capitalizedType }));
    } catch (error) {
      if (deleted.length > 0) updateRowList(deleted);
      toast.error(
        getV3ApiErrorMessage(
          error,
          t("common.an_unknown_error_occurred_while_deleting_table_items", { type: capitalizedType })
        )
      );
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
        <Button
          variant="secondary"
          size="sm"
          className="h-6 gap-1 px-2"
          onClick={() => setIsDeleteDialogOpen(true)}>
          {t("common.delete")}
          <Trash2Icon />
        </Button>
      </div>
      <DeleteDialog
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        deleteWhat={deleteWhatText}
        onDelete={handleDelete}
        isDeleting={isDeleting}
        text={deleteDialogText}>
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
