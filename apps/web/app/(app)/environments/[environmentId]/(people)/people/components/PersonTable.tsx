import { generatePersonTableColumns } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonTableColumn";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { VisibilityState, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { TPersonTableData } from "@formbricks/types/people";
import { Button } from "@formbricks/ui/Button";
import { DataTableHeader, DataTableSettingsModal, DataTableToolbar } from "@formbricks/ui/DataTable";
import { getCommonPinningStyles } from "@formbricks/ui/DataTable/lib/utils";
import { Skeleton } from "@formbricks/ui/Skeleton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@formbricks/ui/Table";

interface PersonTableProps {
  data: TPersonTableData[];
  fetchNextPage: () => void;
  hasMore: boolean;
  deletePersons: (personIds: string[]) => void;
  isDataLoaded: boolean;
  environmentId: string;
}

export const PersonTable = ({
  data,
  fetchNextPage,
  hasMore,
  deletePersons,
  isDataLoaded,
  environmentId,
}: PersonTableProps) => {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [isTableSettingsModalOpen, setIsTableSettingsModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState<boolean | null>(null);
  const [rowSelection, setRowSelection] = useState({});
  const router = useRouter();
  // Generate columns
  const columns = useMemo(() => generatePersonTableColumns(isExpanded ?? false), [isExpanded]);

  // Load saved settings from localStorage
  useEffect(() => {
    const savedColumnOrder = localStorage.getItem(`${environmentId}-columnOrder`);
    const savedColumnVisibility = localStorage.getItem(`${environmentId}-columnVisibility`);
    const savedExpandedSettings = localStorage.getItem(`${environmentId}-rowExpand`);
    if (savedColumnOrder && JSON.parse(savedColumnOrder).length > 0) {
      setColumnOrder(JSON.parse(savedColumnOrder));
    } else {
      setColumnOrder(table.getAllLeafColumns().map((d) => d.id));
    }

    if (savedColumnVisibility) {
      setColumnVisibility(JSON.parse(savedColumnVisibility));
    }
    if (savedExpandedSettings !== null) {
      setIsExpanded(JSON.parse(savedExpandedSettings));
    }
  }, [environmentId]);

  // Save settings to localStorage when they change
  useEffect(() => {
    if (columnOrder.length > 0) {
      localStorage.setItem(`${environmentId}-columnOrder`, JSON.stringify(columnOrder));
    }
    if (Object.keys(columnVisibility).length > 0) {
      localStorage.setItem(`${environmentId}-columnVisibility`, JSON.stringify(columnVisibility));
    }

    if (isExpanded !== null) {
      localStorage.setItem(`${environmentId}-rowExpand`, JSON.stringify(isExpanded));
    }
  }, [columnOrder, columnVisibility, isExpanded, environmentId]);

  // Initialize DnD sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  // Memoize table data and columns
  const tableData: TPersonTableData[] = useMemo(
    () => (!isDataLoaded ? Array(10).fill({}) : data),
    [data, isDataLoaded]
  );
  const tableColumns = useMemo(
    () =>
      !isDataLoaded
        ? columns.map((column) => ({
            ...column,
            cell: () => (
              <Skeleton className="w-full">
                <div className="h-6"></div>
              </Skeleton>
            ),
          }))
        : columns,
    [columns, data]
  );

  // React Table instance
  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    getRowId: (originalRow) => originalRow.personId,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    columnResizeMode: "onChange",
    columnResizeDirection: "ltr",
    manualPagination: true,
    defaultColumn: { size: 300 },
    state: {
      columnOrder,
      columnVisibility,
      rowSelection,
      columnPinning: {
        left: ["select", "createdAt"],
      },
    },
  });

  // Handle column drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((prevOrder) => {
        const oldIndex = prevOrder.indexOf(active.id as string);
        const newIndex = prevOrder.indexOf(over.id as string);
        return arrayMove(prevOrder, oldIndex, newIndex);
      });
    }
  };

  return (
    <div>
      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={handleDragEnd}
        sensors={sensors}>
        <DataTableToolbar
          setIsExpanded={setIsExpanded}
          setIsTableSettingsModalOpen={setIsTableSettingsModalOpen}
          isExpanded={isExpanded ?? false}
          table={table}
          deleteRows={deletePersons}
          type="person"
        />
        <div className="w-fit max-w-full overflow-hidden overflow-x-auto rounded-xl border border-slate-200">
          <div className="w-full overflow-x-auto">
            <Table style={{ width: table.getCenterTotalSize(), tableLayout: "fixed" }}>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                      {headerGroup.headers.map((header) => (
                        <DataTableHeader
                          key={header.id}
                          header={header}
                          setIsTableSettingsModalOpen={setIsTableSettingsModalOpen}
                        />
                      ))}
                    </SortableContext>
                  </tr>
                ))}
              </TableHeader>

              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={"group cursor-pointer"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        onClick={() => {
                          if (cell.column.id === "select") return;
                          router.push(`/environments/${environmentId}/people/${row.id}`);
                        }}
                        style={cell.column.id === "select" ? getCommonPinningStyles(cell.column) : {}}
                        className={cn(
                          "border-slate-200 bg-white shadow-none group-hover:bg-slate-100",
                          row.getIsSelected() && "bg-slate-100",
                          {
                            "border-r": !cell.column.getIsLastColumn(),
                            "border-l": !cell.column.getIsFirstColumn(),
                          }
                        )}>
                        <div
                          className={cn("flex flex-1 items-center truncate", isExpanded ? "h-full" : "h-10")}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {table.getRowModel().rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {data && hasMore && data.length > 0 && (
          <div className="mt-4 flex justify-center">
            <Button onClick={fetchNextPage} className="bg-blue-500 text-white">
              Load More
            </Button>
          </div>
        )}

        <DataTableSettingsModal
          open={isTableSettingsModalOpen}
          setOpen={setIsTableSettingsModalOpen}
          table={table}
          columnOrder={columnOrder}
          handleDragEnd={handleDragEnd}
        />
      </DndContext>
    </div>
  );
};
