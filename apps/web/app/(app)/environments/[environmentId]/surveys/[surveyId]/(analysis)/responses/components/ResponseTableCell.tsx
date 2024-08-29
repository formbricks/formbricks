import { getCommonPinningStyles } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTableHeader";
import { Cell, Row, flexRender } from "@tanstack/react-table";
import { Maximize2Icon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";
import { TResponse, TResponseTableData } from "@formbricks/types/responses";
import { TableCell } from "@formbricks/ui/Table";

interface ResponseTableCellProps {
  cell: Cell<TResponseTableData, unknown>;
  row: Row<TResponseTableData>;
  isExpanded: boolean;
  setSelectedResponseCard: (responseCard: TResponse) => void;
  responses: TResponse[] | null;
}

export const ResponseTableCell = ({
  cell,
  row,
  isExpanded,
  setSelectedResponseCard,
  responses,
}: ResponseTableCellProps) => {
  // Function to handle cell click
  const handleCellClick = () => {
    if (cell.column.id !== "select") {
      const response = responses?.find((response) => response.id === row.id);
      if (response) setSelectedResponseCard(response);
    }
  };

  const cellStyles = {
    width: `${cell.column.getSize()}px`,
    ...(cell.column.id === "select" ? getCommonPinningStyles(cell.column) : {}),
  };

  // Conditional rendering of maximize icon
  const renderMaximizeIcon = cell.column.id === "createdAt" && (
    <div
      className="hidden flex-shrink-0 cursor-pointer items-center rounded-md border border-slate-200 bg-white p-2 hover:border-slate-300 group-hover:flex"
      onClick={handleCellClick}>
      <Maximize2Icon className="h-4 w-4" />
    </div>
  );

  return (
    <TableCell
      key={cell.id}
      className={cn(
        "border border-slate-300 bg-white shadow-none group-hover:bg-slate-100",
        row.getIsSelected() && "bg-slate-100"
      )}
      style={cellStyles}
      onClick={handleCellClick}>
      <div className="flex w-full items-center">
        <div className={cn("flex flex-1 items-center truncate", isExpanded ? "h-full" : "h-10")}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </div>
        {renderMaximizeIcon}
      </div>
    </TableCell>
  );
};
