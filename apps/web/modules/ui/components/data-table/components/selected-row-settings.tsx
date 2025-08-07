"use client";

import { capitalizeFirstLetter } from "@/lib/utils/strings";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { cn } from "@/modules/ui/lib/utils";
import { Table } from "@tanstack/react-table";
import { useTranslate } from "@tolgee/react";
import { ArrowDownToLineIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";

interface SelectedRowSettingsProps<T> {
  table: Table<T>;
  deleteRowsAction: (rowId: string[]) => void;
  type: "response" | "contact";
  deleteAction: (id: string) => Promise<void>;
  downloadRowsAction?: (rowIds: string[], format: string) => Promise<void>;
}

export const SelectedRowSettings = <T,>({
  table,
  deleteRowsAction,
  type,
  deleteAction,
  downloadRowsAction,
}: SelectedRowSettingsProps<T>) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
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

      if (type === "response" || type === "contact") {
        await Promise.all(rowsToBeDeleted.map((rowId) => deleteAction(rowId)));
      }

      deleteRowsAction(rowsToBeDeleted);
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
  const handleDownloadSelectedRows = async (format: string) => {
    setIsDownloading(true);
    const rowsToDownload = table.getFilteredSelectedRowModel().rows.map((row) => row.id);
    if (downloadRowsAction && rowsToDownload.length > 0) {
      await downloadRowsAction(rowsToDownload, format);
    }
    setIsDownloading(false);
  };

  // Helper component for the separator
  const Separator = () => <div>|</div>;

  const deleteDialogText =
    type === "response"
      ? t("environments.surveys.responses.delete_response_confirmation")
      : t("environments.contacts.delete_contact_confirmation");

  return (
    <>
      <div className="bg-primary flex items-center gap-x-2 rounded-md p-1 px-2 text-xs text-white">
        <div className="lowercase">
          {`${selectedRowCount} ${type === "response" ? t("common.responses") : t("common.contacts")} ${t("common.selected")}`}
        </div>
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
          <DropdownMenu>
            <DropdownMenuTrigger
              asChild
              className={cn(isDownloading && "cursor-not-allowed opacity-50")}
              disabled={isDownloading}>
              <Button variant="outline" size="sm" className="h-6 gap-1 border-none px-2">
                {isDownloading ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <ArrowDownToLineIcon />}
                {t("common.download")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => {
                  handleDownloadSelectedRows("csv");
                }}>
                <p className="text-slate-700">{t("environments.surveys.summary.selected_responses_csv")}</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  handleDownloadSelectedRows("xlsx");
                }}>
                <p>{t("environments.surveys.summary.selected_responses_excel")}</p>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
        deleteWhat={type === "response" ? t("common.responses") : t("common.contacts")}
        onDelete={handleDelete}
        isDeleting={isDeleting}
        text={deleteDialogText}
      />
    </>
  );
};
