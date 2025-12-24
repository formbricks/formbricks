"use client";

import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment } from "@formbricks/types/segment";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { EditSegmentModal } from "./edit-segment-modal";
import { generateSegmentTableColumns } from "./segment-table-columns";

interface SegmentTableUpdatedProps {
  segments: TSegment[];
  contactAttributeKeys: TContactAttributeKey[];
  isContactsEnabled: boolean;
  isReadOnly: boolean;
}

export function SegmentTableUpdated({
  segments,
  contactAttributeKeys,
  isContactsEnabled,
  isReadOnly,
}: SegmentTableUpdatedProps) {
  const { t } = useTranslation();
  const [editingSegment, setEditingSegment] = useState<TSegment | null>(null);

  const columns = useMemo(() => {
    return generateSegmentTableColumns();
  }, []);

  const table = useReactTable({
    data: segments,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <div className="rounded-lg border border-slate-200">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="rounded-t-lg">
                {headerGroup.headers.map((header, index) => {
                  const isFirstHeader = index === 0;
                  const isLastHeader = index === headerGroup.headers.length - 1;
                  return (
                    <TableHead
                      key={header.id}
                      className={`h-10 border-b border-slate-200 bg-white px-4 font-semibold ${
                        isFirstHeader ? "rounded-tl-lg" : isLastHeader ? "rounded-tr-lg" : ""
                      }`}>
                      {header.isPlaceholder
                        ? null
                        : typeof header.column.columnDef.header === "function"
                          ? header.column.columnDef.header(header.getContext())
                          : header.column.columnDef.header}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, rowIndex) => {
                const isLastRow = rowIndex === table.getRowModel().rows.length - 1;
                return (
                  <TableRow
                    key={row.id}
                    onClick={() => setEditingSegment(row.original)}
                    className={`cursor-pointer hover:bg-slate-50 ${isLastRow ? "rounded-b-lg" : ""}`}>
                    {row.getVisibleCells().map((cell, cellIndex) => {
                      const isFirstCell = cellIndex === 0;
                      const isLastCell = cellIndex === row.getVisibleCells().length - 1;
                      return (
                        <TableCell
                          key={cell.id}
                          className={
                            isLastRow
                              ? isFirstCell
                                ? "rounded-bl-lg"
                                : isLastCell
                                  ? "rounded-br-lg"
                                  : ""
                              : ""
                          }>
                          {typeof cell.column.columnDef.cell === "function"
                            ? cell.column.columnDef.cell(cell.getContext())
                            : cell.column.columnDef.cell}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <TableRow className="hover:bg-white">
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <p className="text-slate-400">{t("environments.segments.create_your_first_segment")}</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Segment Modal */}
      {editingSegment && (
        <EditSegmentModal
          environmentId={editingSegment.environmentId}
          open={!!editingSegment}
          setOpen={(open) => !open && setEditingSegment(null)}
          currentSegment={editingSegment}
          contactAttributeKeys={contactAttributeKeys}
          segments={segments}
          isContactsEnabled={isContactsEnabled}
          isReadOnly={isReadOnly}
        />
      )}
    </>
  );
}
