import { ColumnSettingsDropdown } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ColumnSettingsDropdown";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Column, Header, flexRender } from "@tanstack/react-table";
import { GripVerticalIcon } from "lucide-react";
import { CSSProperties } from "react";
import { cn } from "@formbricks/lib/cn";
import { TResponseTableData } from "@formbricks/types/responses";
import { TableHead } from "@formbricks/ui/Table";

interface ResponseTableHeaderProps {
  header: Header<TResponseTableData, unknown>;
  setIsTableSettingsModalOpen: (isTableSettingsModalOpen: boolean) => void;
}

export const getCommonPinningStyles = (column: Column<TResponseTableData>): CSSProperties => {
  return {
    left: `${column.getStart("left") - 1}px`,
    position: "sticky",
    width: column.getSize(),
    zIndex: 1,
  };
};

export const ResponseTableHeader = ({ header, setIsTableSettingsModalOpen }: ResponseTableHeaderProps) => {
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
      className="group relative h-10 border border-slate-300 bg-slate-200 px-2 text-center">
      <div className="flex items-center justify-between">
        <div className="truncate text-left font-semibold">
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
    </TableHead>
  );
};
