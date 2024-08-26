import { TTableData } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/Columns";
import { Table } from "@tanstack/react-table";
import { Trash2Icon } from "lucide-react";
import React, { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";
import { deleteResponseAction } from "@formbricks/ui/SingleResponseCard/actions";

interface SelectedResponseSettingsProps {
  table: Table<TTableData>;
  deleteResponses: (responseIds: string[]) => void;
}

export const SelectedResponseSettings = ({ table, deleteResponses }: SelectedResponseSettingsProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedRowCount = table.getFilteredSelectedRowModel().rows.length;

  // Toggle all rows selection
  const handleToggleAllRowsSelection = useCallback(
    (selectAll: boolean) => {
      table.toggleAllPageRowsSelected(selectAll);
    },
    [table]
  );

  // Handle deletion of responses
  const handleDeleteResponses = async () => {
    try {
      setIsDeleting(true);
      const rowsToBeDeleted = table.getFilteredSelectedRowModel().rows.map((row) => row.id);
      await Promise.all(rowsToBeDeleted.map((responseId) => deleteResponseAction({ responseId })));

      deleteResponses(rowsToBeDeleted);
      toast.success("Responses deleted successfully");
    } catch (error) {
      toast.error(error.message || "An error occurred while deleting responses");
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  // Helper component for the separator
  const Separator = () => <div className="mx-2">|</div>;

  // Helper component for selectable options
  const SelectableOption = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <div className="cursor-pointer rounded-md p-2 hover:bg-slate-600" onClick={onClick}>
      {label}
    </div>
  );

  return (
    <div className="flex items-center rounded-md bg-slate-900 p-1 px-2 text-xs text-white">
      <div className="rounded-md p-2">{selectedRowCount} responses selected</div>
      <Separator />
      <SelectableOption label="Select all" onClick={() => handleToggleAllRowsSelection(true)} />
      <SelectableOption label="Clear selection" onClick={() => handleToggleAllRowsSelection(false)} />
      <Separator />
      <div
        className="ml-2 cursor-pointer rounded-md bg-slate-500 p-1"
        onClick={() => setIsDeleteDialogOpen(true)}>
        <Trash2Icon className="h-4 w-4" />
      </div>
      <DeleteDialog
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        deleteWhat="response"
        onDelete={handleDeleteResponses}
        isDeleting={isDeleting}
      />
    </div>
  );
};
