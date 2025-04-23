"use client";

import { capitalizeFirstLetter } from "@/lib/utils/strings";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { Table } from "@tanstack/react-table";
import { useTranslate } from "@tolgee/react";
import { Trash2Icon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";

interface SelectedRowSettingsProps<T> {
  table: Table<T>;
  deleteRows: (rowId: string[]) => void;
  type: "response" | "contact";
  deleteAction: (id: string) => Promise<void>;
  downloadSelectedRows?: (rowIds: string[]) => void;
}

export const SelectedRowSettings = <T,>({
  table,
  deleteRows,
  type,
  deleteAction,
  downloadSelectedRows,
}: SelectedRowSettingsProps<T>) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { t } = useTranslate();
  const selectedRowCount = table.getFilteredSelectedRowModel().rows.length;

  // Toggle all rows selection
  const handleToggleAllRowsSelection = useCallback(
    (selectAll: boolean) => {
      table.toggleAllPageRowsSelected(selectAll);
    },
    [table]
  );

  // Handle deletion
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const rowsToBeDeleted = table.getFilteredSelectedRowModel().rows.map((row) => row.id);

      if (type === "response") {
        await Promise.all(rowsToBeDeleted.map((responseId) => deleteAction(responseId)));
      } else if (type === "contact") {
        await Promise.all(rowsToBeDeleted.map((responseId) => deleteAction(responseId)));
      }

      deleteRows(rowsToBeDeleted);
      toast.success(t("common.table_items_deleted_successfully", { type: capitalizeFirstLetter(type) }));
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error(
          t("common.an_unknown_error_occurred_while_deleting_table_items", {
            type: capitalizeFirstLetter(type),
          })
        );
      }
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  // Handle download selected rows
  const handleDownloadSelectedRows = async () => {
    const rowsToDownload = table.getFilteredSelectedRowModel().rows.map((row) => row.id);
    console.log("Selected Row IDs:", rowsToDownload);
    if (downloadSelectedRows && rowsToDownload.length > 0) {
      console.log("Function:", downloadSelectedRows(rowsToDownload));
      downloadSelectedRows(rowsToDownload);
    }
  };

  // Helper component for the separator
  const Separator = () => <div>|</div>;

  // Helper component for selectable options
  const SelectableOption = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <div className="cursor-pointer rounded-md p-1 hover:bg-slate-500" onClick={onClick}>
      {label}
    </div>
  );

  return (
    <div className="flex items-center gap-x-2 rounded-md bg-slate-900 p-1 px-2 text-xs text-white">
      <div className="lowercase">
        {selectedRowCount} {t(`common.${type}`)}s {t("common.selected")}
      </div>
      <Separator />
      <SelectableOption label={t("common.select_all")} onClick={() => handleToggleAllRowsSelection(true)} />
      <Separator />
      <SelectableOption
        label={t("common.clear_selection")}
        onClick={() => handleToggleAllRowsSelection(false)}
      />
      <Separator />
      {downloadSelectedRows && (
        <>
          <SelectableOption
            label={t("common.download")}
            onClick={() => {
              handleDownloadSelectedRows();
            }}
          />
          <Separator />
        </>
      )}
      <div
        className="cursor-pointer rounded-md bg-slate-500 p-1 hover:bg-slate-600"
        onClick={() => setIsDeleteDialogOpen(true)}>
        <Trash2Icon strokeWidth={1.5} className="h-4 w-4" />
      </div>
      <DeleteDialog
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        deleteWhat={t(`common.${type}`)}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};
