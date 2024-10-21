import { Table } from "@tanstack/react-table";
import { Trash2Icon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { capitalizeFirstLetter } from "@formbricks/lib/utils/strings";
import { DeleteDialog } from "../../DeleteDialog";
import { deleteResponseAction } from "../../SingleResponseCard/actions";

interface SelectedRowSettingsProps<T> {
  table: Table<T>;
  deleteRows: (rowId: string[]) => void;
  type: "response" | "contact";
}

export const SelectedRowSettings = <T,>({ table, deleteRows, type }: SelectedRowSettingsProps<T>) => {
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

  // Handle deletion
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const rowsToBeDeleted = table.getFilteredSelectedRowModel().rows.map((row) => row.id);

      if (type === "response") {
        await Promise.all(rowsToBeDeleted.map((responseId) => deleteResponseAction({ responseId })));
      } else if (type === "contact") {
        // await Promise.all(rowsToBeDeleted.map((personId) => deletePersonAction({ personId })));
      }

      deleteRows(rowsToBeDeleted);
      toast.success(`${capitalizeFirstLetter(type)}s deleted successfully`);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error(`An unknown error occurred while deleting ${type}s`);
      }
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
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
      <div>
        {selectedRowCount} {type}s selected
      </div>
      <Separator />
      <SelectableOption label="Select all" onClick={() => handleToggleAllRowsSelection(true)} />
      <Separator />
      <SelectableOption label="Clear selection" onClick={() => handleToggleAllRowsSelection(false)} />
      <Separator />
      <div
        className="cursor-pointer rounded-md bg-slate-500 p-1 hover:bg-slate-600"
        onClick={() => setIsDeleteDialogOpen(true)}>
        <Trash2Icon strokeWidth={1.5} className="h-4 w-4" />
      </div>
      <DeleteDialog
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        deleteWhat={type}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};
