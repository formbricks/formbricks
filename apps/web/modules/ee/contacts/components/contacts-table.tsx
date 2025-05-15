"use client";

import { cn } from "@/lib/cn";
import { deleteContactAction } from "@/modules/ee/contacts/actions";
import { Button } from "@/modules/ui/components/button";
import {
  DataTableHeader,
  DataTableSettingsModal,
  DataTableToolbar,
} from "@/modules/ui/components/data-table";
import { getCommonPinningStyles } from "@/modules/ui/components/data-table/lib/utils";
import { SearchBar } from "@/modules/ui/components/search-bar";
import { Skeleton } from "@/modules/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/modules/ui/components/table";
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
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { VisibilityState, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslate } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TContactTableData } from "../types/contact";
import { generateContactTableColumns } from "./contact-table-column";

interface ContactsTableProps {
  data: TContactTableData[];
  fetchNextPage: () => void;
  hasMore: boolean;
  deleteContacts: (contactIds: string[]) => void;
  isDataLoaded: boolean;
  environmentId: string;
  searchValue: string;
  setSearchValue: (value: string) => void;
  isReadOnly: boolean;
  refreshContacts: () => Promise<void>;
}

export const ContactsTable = ({
  data,
  fetchNextPage,
  hasMore,
  deleteContacts,
  isDataLoaded,
  environmentId,
  searchValue,
  setSearchValue,
  isReadOnly,
  refreshContacts,
}: ContactsTableProps) => {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [isTableSettingsModalOpen, setIsTableSettingsModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState<boolean | null>(null);
  const [rowSelection, setRowSelection] = useState({});
  const router = useRouter();
  const { t } = useTranslate();

  const [parent] = useAutoAnimate();

  // Generate columns
  const columns = useMemo(() => {
    return generateContactTableColumns(searchValue, data, isReadOnly);
  }, [searchValue, data, isReadOnly]);

  // Load saved settings from localStorage
  useEffect(() => {
    const savedColumnOrder = localStorage.getItem(`${environmentId}-columnOrder`);
    const savedColumnVisibility = localStorage.getItem(`${environmentId}-columnVisibility`);
    const savedExpandedSettings = localStorage.getItem(`${environmentId}-rowExpand`);

    let savedColumnOrderParsed: string[] = [];
    if (savedColumnOrder) {
      try {
        savedColumnOrderParsed = JSON.parse(savedColumnOrder);
      } catch (err) {
        console.error(err);
      }
    }

    if (
      savedColumnOrderParsed.length > 0 &&
      table.getAllLeafColumns().length === savedColumnOrderParsed.length
    ) {
      setColumnOrder(savedColumnOrderParsed);
    } else {
      setColumnOrder(table.getAllLeafColumns().map((d) => d.id));
    }

    let savedColumnVisibilityParsed: VisibilityState = {};
    if (savedColumnVisibility) {
      try {
        savedColumnVisibilityParsed = JSON.parse(savedColumnVisibility);
      } catch (err) {
        console.error(err);
      }
    }

    if (
      savedColumnVisibilityParsed &&
      Object.keys(savedColumnVisibilityParsed).length === table.getAllLeafColumns().length
    ) {
      setColumnVisibility(savedColumnVisibilityParsed);
    } else {
      const initialVisibility = table
        .getAllLeafColumns()
        .map((column) => column.id)
        .reduce((acc, curr) => {
          acc[curr] = false;
          return acc;
        }, {}) as Record<string, true>;

      const userIdVisibility = data.findIndex((contact) => contact.userId) !== -1;

      setColumnVisibility({
        ...initialVisibility,
        userId: userIdVisibility,
        select: true,
        email: true,
        firstName: true,
        lastName: true,
      });
    }

    if (savedExpandedSettings !== null) {
      setIsExpanded(JSON.parse(savedExpandedSettings));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const tableData: TContactTableData[] = useMemo(
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
    [columns, isDataLoaded]
  );

  // React Table instance
  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    getRowId: (originalRow) => originalRow.id,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    columnResizeMode: "onChange",
    columnResizeDirection: "ltr",
    manualPagination: true,
    defaultColumn: { maxSize: 1000, size: 300 },
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

  const deleteContact = async (contactId: string) => {
    await deleteContactAction({ contactId });
  };

  return (
    <div className="w-full">
      <SearchBar
        value={searchValue}
        onChange={setSearchValue}
        placeholder={t("environments.contacts.search_contact")}
      />
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
          deleteRows={deleteContacts}
          type="contact"
          deleteAction={deleteContact}
          refreshContacts={refreshContacts}
        />
        <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
          <Table className="w-full" style={{ tableLayout: "fixed" }}>
            <TableHeader className="pointer-events-auto">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {headerGroup.headers.map((header) => (
                      <DataTableHeader
                        key={header.id}
                        header={header}
                        setIsTableSettingsModalOpen={setIsTableSettingsModalOpen}
                      />
                    ))}
                  </SortableContext>
                </TableRow>
              ))}
            </TableHeader>

            <TableBody ref={parent}>
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
                        router.push(`/environments/${environmentId}/contacts/${row.id}`);
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
                    {t("common.no_results")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {data && hasMore && data.length > 0 && (
          <div className="mt-4 flex justify-center">
            <Button onClick={fetchNextPage}>{t("common.load_more")}</Button>
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
