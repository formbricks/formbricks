"use client";

import { Switch } from "@/modules/ui/components/switch";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Column, Table, flexRender } from "@tanstack/react-table";
import { GripVertical } from "lucide-react";
import { TSurvey } from "@formbricks/types/surveys/types";

interface DataTableSettingsModalItemProps<T> {
  column: Column<T, unknown>;
  table: Table<T>;
  survey?: TSurvey;
}

export const DataTableSettingsModalItem = <T,>({ column, table }: DataTableSettingsModalItemProps<T>) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });

  const style = {
    transition: transition ?? "transform 100ms ease",
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 10 : 1,
  };

  // Find the header for this column from the table's header groups
  const header = table
    .getHeaderGroups()
    .flatMap((headerGroup) => headerGroup.headers)
    .find((h) => h.column.id === column.id);

  return (
    <div ref={setNodeRef} style={style} id={column.id}>
      <div {...listeners} {...attributes}>
        <div
          key={column.id}
          className="flex w-full items-center justify-between gap-4 rounded-md p-1.5 hover:cursor-move hover:bg-slate-100">
          <div className="flex items-center space-x-2 overflow-hidden">
            <button type="button" aria-label="Reorder column" onClick={(e) => e.preventDefault()}>
              <GripVertical className="h-4 w-4" />
            </button>
            {flexRender(column.columnDef.header, header?.getContext() ?? { column })}
          </div>
          <Switch
            id={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(value) => column.toggleVisibility(!!value)}
            disabled={false}
          />
        </div>
      </div>
    </div>
  );
};
