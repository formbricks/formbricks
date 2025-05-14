import { cn } from "@/lib/cn";
import { TableHead } from "@/modules/ui/components/table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Header, flexRender } from "@tanstack/react-table";
import { GripVerticalIcon } from "lucide-react";
import { CSSProperties } from "react";
import { getCommonPinningStyles } from "../lib/utils";
import { ColumnSettingsDropdown } from "./column-settings-dropdown";

interface DataTableHeaderProps<T> {
  header: Header<T, unknown>;
  setIsTableSettingsModalOpen: (isTableSettingsModalOpen: boolean) => void;
}

export const DataTableHeader = <T,>({ header, setIsTableSettingsModalOpen }: DataTableHeaderProps<T>) => {
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
    ...(header.column.id === "select" ? getCommonPinningStyles(header.column) : {}),
  };

  return (
    <TableHead
      colSpan={header.colSpan}
      ref={setNodeRef}
      style={style}
      key={header.id}
      className={cn("group relative h-10 border-b border-slate-200 bg-white px-4 text-center", {
        "border-r": !header.column.getIsLastColumn(),
        "border-l": !header.column.getIsFirstColumn(),
      })}>
      <div className="flex items-center justify-between">
        <div className="w-full truncate text-left font-semibold">
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
          data-testid="column-resize-handle"
          className={cn(
            "absolute top-0 right-0 hidden h-full w-1 cursor-col-resize bg-slate-500",
            header.column.getIsResizing() ? "bg-black" : "bg-slate-500",
            !header.column.getCanResize() ? "hidden" : "group-hover:block"
          )}
        />
      </div>
    </TableHead>
  );
};
