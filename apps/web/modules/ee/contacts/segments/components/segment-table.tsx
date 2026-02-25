"use client";

import { Header, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegmentWithSurveyNames } from "@formbricks/types/segment";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { EditSegmentModal } from "./edit-segment-modal";
import { generateSegmentTableColumns } from "./segment-table-columns";

interface SegmentTableUpdatedProps {
  segments: TSegmentWithSurveyNames[];
  contactAttributeKeys: TContactAttributeKey[];
  isContactsEnabled: boolean;
  isReadOnly: boolean;
}

export function SegmentTable({
  segments,
  contactAttributeKeys,
  isContactsEnabled,
  isReadOnly,
}: SegmentTableUpdatedProps) {
  const { t } = useTranslation();
  const [editingSegment, setEditingSegment] = useState<TSegmentWithSurveyNames | null>(null);

  const columns = useMemo(() => {
    return generateSegmentTableColumns(t);
  }, []);

  const table = useReactTable({
    data: segments,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const getHeader = (header: Header<TSegmentWithSurveyNames, unknown>) => {
    if (header.isPlaceholder) {
      return null;
    }

    if (typeof header.column.columnDef.header === "function") {
      return header.column.columnDef.header(header.getContext());
    }

    return header.column.columnDef.header;
  };

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
                  const getHeaderClass = () => {
                    if (isFirstHeader) {
                      return "rounded-tl-lg";
                    }

                    if (isLastHeader) {
                      return "rounded-tr-lg";
                    }

                    return "";
                  };

                  return (
                    <TableHead
                      key={header.id}
                      className={`h-10 border-b border-slate-200 bg-white px-4 font-semibold ${getHeaderClass()}`}>
                      {getHeader(header)}
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
                      const getCellClass = () => {
                        if (!isLastRow) {
                          return "";
                        }

                        if (isFirstCell) {
                          return "rounded-bl-lg";
                        }

                        if (isLastCell) {
                          return "rounded-br-lg";
                        }

                        return "";
                      };

                      return (
                        <TableCell key={cell.id} className={getCellClass()}>
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
                <TableCell colSpan={columns.length} className="h-24 rounded-b-lg text-center">
                  <p className="text-slate-400">{t("environments.segments.create_your_first_segment")}</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
