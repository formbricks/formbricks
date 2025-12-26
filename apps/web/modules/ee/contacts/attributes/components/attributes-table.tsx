"use client";

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
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TUserLocale } from "@formbricks/types/user";
import { cn } from "@/lib/cn";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  DataTableHeader,
  DataTableSettingsModal,
  DataTableToolbar,
} from "@/modules/ui/components/data-table";
import { getCommonPinningStyles } from "@/modules/ui/components/data-table/lib/utils";
import { SearchBar } from "@/modules/ui/components/search-bar";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/modules/ui/components/table";
import { deleteContactAttributeKeyAction } from "../actions";
import { generateAttributeTableColumns } from "./attribute-table-column";
import { EditAttributeModal } from "./edit-attribute-modal";

interface AttributesTableProps {
  contactAttributeKeys: TContactAttributeKey[];
  isReadOnly: boolean;
  environmentId: string;
  locale: TUserLocale;
}

export const AttributesTable = ({
  contactAttributeKeys,
  isReadOnly,
  environmentId,
  locale,
}: AttributesTableProps) => {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [isTableSettingsModalOpen, setIsTableSettingsModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState<boolean | null>(null);
  const [rowSelection, setRowSelection] = useState({});
  const [searchValue, setSearchValue] = useState<string>("");
  const [editingAttribute, setEditingAttribute] = useState<TContactAttributeKey | null>(null);
  const router = useRouter();
  const { t } = useTranslation();

  const [parent] = useAutoAnimate();

  // Filter attributes based on search
  const filteredAttributes = useMemo(() => {
    if (!searchValue) return contactAttributeKeys;
    const searchLower = searchValue.toLowerCase();
    return contactAttributeKeys.filter(
      (attr) =>
        attr.key.toLowerCase().includes(searchLower) ||
        attr.name?.toLowerCase().includes(searchLower) ||
        attr.description?.toLowerCase().includes(searchLower)
    );
  }, [contactAttributeKeys, searchValue]);

  // Check if all filtered attributes are system attributes
  const allSystemAttributes = useMemo(() => {
    return filteredAttributes.length > 0 && filteredAttributes.every((attr) => attr.type === "default");
  }, [filteredAttributes]);

  // Generate columns
  const columns = useMemo(() => {
    return generateAttributeTableColumns(searchValue, isReadOnly, isExpanded ?? false, t, locale);
  }, [searchValue, isReadOnly, isExpanded]);

  // Load saved settings from localStorage
  useEffect(() => {
    const savedColumnOrder = localStorage.getItem(`${environmentId}-attributes-columnOrder`);
    const savedColumnVisibility = localStorage.getItem(`${environmentId}-attributes-columnVisibility`);
    const savedExpandedSettings = localStorage.getItem(`${environmentId}-attributes-rowExpand`);

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
          acc[curr] = true;
          return acc;
        }, {}) as Record<string, true>;

      setColumnVisibility(initialVisibility);
    }

    if (savedExpandedSettings !== null) {
      try {
        setIsExpanded(JSON.parse(savedExpandedSettings));
      } catch (err) {
        console.error(err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environmentId]);

  // Hide select column when all attributes are system attributes
  useEffect(() => {
    if (!isReadOnly && allSystemAttributes) {
      setColumnVisibility((prev) => ({
        ...prev,
        select: false,
      }));
    } else if (!isReadOnly && !allSystemAttributes) {
      setColumnVisibility((prev) => ({
        ...prev,
        select: true,
      }));
    }
  }, [allSystemAttributes, isReadOnly]);

  // Save settings to localStorage when they change
  useEffect(() => {
    if (columnOrder.length > 0) {
      localStorage.setItem(`${environmentId}-attributes-columnOrder`, JSON.stringify(columnOrder));
    }

    if (Object.keys(columnVisibility).length > 0) {
      localStorage.setItem(`${environmentId}-attributes-columnVisibility`, JSON.stringify(columnVisibility));
    }

    if (isExpanded !== null) {
      localStorage.setItem(`${environmentId}-attributes-rowExpand`, JSON.stringify(isExpanded));
    }
  }, [columnOrder, columnVisibility, isExpanded, environmentId]);

  // Initialize DnD sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  // React Table instance
  const table = useReactTable({
    data: filteredAttributes,
    columns,
    getRowId: (originalRow) => originalRow.id,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    columnResizeMode: "onChange",
    columnResizeDirection: "ltr",
    defaultColumn: { maxSize: 1000, size: 300 },
    enableRowSelection: (row) => {
      // Only allow selection of custom attributes
      return row.original.type === "custom";
    },
    state: {
      columnOrder,
      columnVisibility,
      rowSelection,
      columnPinning: {
        left: allSystemAttributes ? ["createdAt"] : ["select", "createdAt"],
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

  const deleteAttribute = async (attributeId: string) => {
    const deleteContactAttributeKeyResponse = await deleteContactAttributeKeyAction({ id: attributeId });
    if (!deleteContactAttributeKeyResponse?.data) {
      const errorMessage = getFormattedErrorMessage(deleteContactAttributeKeyResponse);
      throw new Error(errorMessage);
    }
  };

  const updateAttributeList = () => {
    router.refresh();
  };

  return (
    <div className="w-full">
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
          updateRowList={updateAttributeList}
          type="attribute"
          deleteAction={deleteAttribute}
          isQuotasAllowed={false}
          leftContent={
            <div className="w-64">
              <SearchBar
                value={searchValue}
                onChange={setSearchValue}
                placeholder={t("environments.contacts.search_attribute_keys")}
              />
            </div>
          }
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
                        showColumnDividers={false}
                      />
                    ))}
                  </SortableContext>
                </TableRow>
              ))}
            </TableHeader>

            <TableBody ref={parent}>
              {table.getRowModel().rows.map((row) => {
                const attribute = row.original;
                const isSystemAttribute = attribute.type === "default";
                const isSelectable = !isSystemAttribute && !isReadOnly;

                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn({
                      "group cursor-pointer": isSelectable,
                      "cursor-default": !isSelectable,
                    })}>
                    {row.getVisibleCells().map((cell) => {
                      // Disable selection for system attributes
                      if (cell.column.id === "select" && isSystemAttribute) {
                        return (
                          <TableCell
                            key={cell.id}
                            style={getCommonPinningStyles(cell.column)}
                            className="bg-white px-4 py-2">
                            <div className="flex w-full items-center justify-center pr-4">
                              {/* Empty checkbox space for system attributes */}
                            </div>
                          </TableCell>
                        );
                      }

                      return (
                        <TableCell
                          key={cell.id}
                          onClick={() => {
                            if (cell.column.id === "select") return;
                            if (isSelectable) {
                              setEditingAttribute(attribute);
                            }
                          }}
                          style={cell.column.id === "select" ? getCommonPinningStyles(cell.column) : {}}
                          className={cn("border-slate-200 bg-white px-4 py-2 shadow-none", {
                            "group-hover:bg-slate-100": isSelectable,
                            "bg-slate-100": row.getIsSelected() && isSelectable,
                          })}>
                          <div
                            className={cn(
                              "flex flex-1 items-center",
                              isExpanded ? "h-auto min-h-10" : "h-full truncate"
                            )}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
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

        <DataTableSettingsModal
          open={isTableSettingsModalOpen}
          setOpen={setIsTableSettingsModalOpen}
          table={table}
          columnOrder={columnOrder}
          handleDragEnd={handleDragEnd}
        />
      </DndContext>

      {editingAttribute && (
        <EditAttributeModal
          attribute={editingAttribute}
          open={!!editingAttribute}
          setOpen={(open) => {
            if (!open) setEditingAttribute(null);
          }}
        />
      )}
    </div>
  );
};
