"use client";

import { VisibilityState, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { SearchBar } from "@/modules/ui/components/search-bar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { deleteAttributeKeyAction } from "../actions";
import { generateAttributeKeysTableColumns } from "./attribute-keys-table-columns";

interface AttributeKeysManagerProps {
  environmentId: string;
  attributeKeys: TContactAttributeKey[];
  isReadOnly: boolean;
}

export function AttributeKeysManager({
  environmentId,
  attributeKeys,
  isReadOnly,
}: AttributeKeysManagerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingKeys, setIsDeletingKeys] = useState(false);
  const [rowSelection, setRowSelection] = useState({});
  const [searchValue, setSearchValue] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Filter to only show custom attribute keys
  const customAttributeKeys = useMemo(() => {
    return attributeKeys.filter((key) => key.type === "custom");
  }, [attributeKeys]);

  // Filter by search
  const filteredAttributeKeys = useMemo(() => {
    if (!searchValue) return customAttributeKeys;

    return customAttributeKeys.filter((key) => {
      const searchLower = searchValue.toLowerCase();
      return (
        key.key.toLowerCase().includes(searchLower) ||
        key.name?.toLowerCase().includes(searchLower) ||
        key.description?.toLowerCase().includes(searchLower)
      );
    });
  }, [customAttributeKeys, searchValue]);

  const columns = useMemo(() => {
    return generateAttributeKeysTableColumns(isReadOnly);
  }, [isReadOnly]);

  const table = useReactTable({
    data: filteredAttributeKeys,
    columns,
    state: {
      rowSelection,
      columnVisibility,
    },
    enableRowSelection: !isReadOnly,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedAttributeKeyIds = selectedRows.map((row) => row.original.id);

  const handleBulkDelete = async () => {
    if (selectedAttributeKeyIds.length === 0) return;

    setIsDeletingKeys(true);
    try {
      const deletePromises = selectedAttributeKeyIds.map((id) =>
        deleteAttributeKeyAction({ environmentId, attributeKeyId: id })
      );

      await Promise.all(deletePromises);

      toast.success(
        t("environments.contacts.attribute_keys_deleted_successfully", {
          count: selectedAttributeKeyIds.length,
        })
      );
      setRowSelection({});
      router.refresh();
    } catch (error) {
      toast.error(t("common.something_went_wrong_please_try_again"));
    } finally {
      setIsDeletingKeys(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <SearchBar
          value={searchValue}
          onChange={setSearchValue}
          placeholder={t("environments.contacts.search_attribute_keys")}
        />
      </div>

      {/* Toolbar with bulk actions */}
      {!isReadOnly && selectedRows.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-sm text-slate-700">
            {t("environments.contacts.selected_attribute_keys", { count: selectedRows.length })}
          </p>
          <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
            {t("common.delete_selected", { count: selectedRows.length })}
          </Button>
        </div>
      )}

      {/* Data Table */}
      <div className="rounded-lg border border-slate-200">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="rounded-t-lg">
                {headerGroup.headers.map((header, index) => {
                  const isFirstHeader = index === 0;
                  const isLastHeader = index === headerGroup.headers.length - 1;
                  // Skip rendering checkbox in the header for selection column
                  if (header.id === "select") {
                    return (
                      <TableHead
                        key={header.id}
                        className="h-10 w-12 rounded-tl-lg border-b border-slate-200 bg-white px-4 font-semibold"
                      />
                    );
                  }
                  return (
                    <TableHead
                      key={header.id}
                      className={`h-10 border-b border-slate-200 bg-white px-4 font-semibold ${
                        isFirstHeader ? "rounded-tl-lg" : isLastHeader ? "rounded-tr-lg" : ""
                      }`}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, index) => {
                const isLastRow = index === table.getRowModel().rows.length - 1;
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={`hover:bg-white ${isLastRow ? "rounded-b-lg" : ""}`}>
                    {row.getVisibleCells().map((cell, cellIndex) => {
                      const isFirstCell = cellIndex === 0;
                      const isLastCell = cellIndex === row.getVisibleCells().length - 1;
                      return (
                        <TableCell
                          key={cell.id}
                          className={`py-2 ${
                            isLastRow
                              ? isFirstCell
                                ? "rounded-bl-lg"
                                : isLastCell
                                  ? "rounded-br-lg"
                                  : ""
                              : ""
                          }`}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <TableRow className="hover:bg-white">
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <p className="text-slate-400">{t("environments.contacts.no_custom_attributes_yet")}</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        deleteWhat={
          selectedRows.length === 1
            ? selectedRows[0].original.name || selectedRows[0].original.key
            : t("environments.contacts.selected_attribute_keys", { count: selectedRows.length })
        }
        onDelete={handleBulkDelete}
        isDeleting={isDeletingKeys}
        text={t("environments.contacts.delete_attribute_keys_warning_detailed", {
          count: selectedRows.length,
        })}
      />
    </div>
  );
}
