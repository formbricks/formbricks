"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "../../Checkbox";

export function getSelectionColumn<T extends object>(): ColumnDef<T, unknown> {
  return {
    id: "select",
    accessorKey: "select",
    size: 60,
    enableResizing: false,
    header: ({ table }) => (
      <div className="flex w-full items-center justify-center pr-4">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex w-full items-center justify-center pr-4">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
  };
}
