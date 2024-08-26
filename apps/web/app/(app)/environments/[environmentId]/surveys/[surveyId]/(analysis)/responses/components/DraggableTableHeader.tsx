import { ColumnSettingsDropdown } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ColumnSettingsDropdown";
import { TTableData } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/Columns";
// needed for row & cell level scope DnD setup
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Header, flexRender } from "@tanstack/react-table";
import { GripVerticalIcon } from "lucide-react";
import React, { CSSProperties } from "react";
import { cn } from "@formbricks/lib/cn";

interface DraggableTableHeaderProps {
  header: Header<TTableData, unknown>;
  setIsTableSettingsModalOpen: (isTableSettingsModalOpen: boolean) => void;
}

export const DraggableTableHeader = ({ header, setIsTableSettingsModalOpen }: DraggableTableHeaderProps) => {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useSortable({
    id: header.column.id,
  });

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: "relative",
    transform: CSS.Translate.toString(transform), // translate instead of transform to avoid squishing
    transition: "width transform 0.2s ease-in-out",
    whiteSpace: "nowrap",
    width: header.column.getSize(),
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <th
      colSpan={header.colSpan}
      ref={setNodeRef}
      style={style}
      key={header.id}
      className="group relative border border-slate-300 p-2 px-4">
      <div className="flex items-center justify-between">
        <div className="flex-1 truncate text-left">
          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
        </div>

        {header.column.id !== "select" && header.column.id !== "createdAt" && (
          <div className="flex">
            <div className="flex-shrink-0">
              <ColumnSettingsDropdown
                column={header.column}
                setIsTableSettingsModalOpen={setIsTableSettingsModalOpen}
              />
            </div>
            <button {...attributes} {...listeners} className="cursor-move">
              <GripVerticalIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Resize handle */}
        <div
          onDoubleClick={() => header.column.resetSize()}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={cn(
            "absolute right-0 top-0 hidden h-full w-1 cursor-col-resize bg-slate-500",
            header.column.getIsResizing() ? "bg-black" : "bg-slate-500",
            !header.column.getCanResize() ? "hidden" : "group-hover:block"
          )}
        />
      </div>
    </th>
  );
};
