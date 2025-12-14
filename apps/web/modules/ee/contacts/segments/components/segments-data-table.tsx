"use client";

import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment, TSegmentWithSurveyNames } from "@formbricks/types/segment";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/modules/ui/components/table";
import { EditSegmentModal } from "./edit-segment-modal";
import { segmentTableColumns } from "./segment-table-columns";

interface SegmentsDataTableProps {
  segments: TSegmentWithSurveyNames[];
  contactAttributeKeys: TContactAttributeKey[];
  isContactsEnabled: boolean;
  isReadOnly: boolean;
}

export const SegmentsDataTable = ({
  segments,
  contactAttributeKeys,
  isContactsEnabled,
  isReadOnly,
}: SegmentsDataTableProps) => {
  const { t } = useTranslation();
  const [selectedSegment, setSelectedSegment] = useState<TSegmentWithSurveyNames | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const table = useReactTable({
    data: segments,
    columns: segmentTableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleRowClick = (segment: TSegmentWithSurveyNames) => {
    setSelectedSegment(segment);
    setIsEditModalOpen(true);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableCell key={header.id} className="font-semibold text-slate-900">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer hover:bg-slate-50"
              onClick={() => handleRowClick(row.original)}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {segments.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={segmentTableColumns.length}
                className="py-6 text-center text-sm text-slate-400">
                {t("environments.segments.create_your_first_segment")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {selectedSegment && (
        <EditSegmentModal
          environmentId={selectedSegment.environmentId}
          open={isEditModalOpen}
          setOpen={setIsEditModalOpen}
          currentSegment={selectedSegment}
          contactAttributeKeys={contactAttributeKeys}
          segments={segments as TSegment[]} // types might slightly differ if WithSurveyNames extends TSegment
          isContactsEnabled={isContactsEnabled}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
};
