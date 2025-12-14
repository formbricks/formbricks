"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format, formatDistanceToNow } from "date-fns";
import { UsersIcon } from "lucide-react";
import { TSegmentWithSurveyNames } from "@formbricks/types/segment";

export const segmentTableColumns: ColumnDef<TSegmentWithSurveyNames>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      const segment = row.original;
      return (
        <div className="flex items-center gap-4">
          <div className="ph-no-capture w-8 flex-shrink-0 text-slate-500">
            <UsersIcon className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <div className="ph-no-capture font-medium text-slate-900">{segment.title}</div>
            {segment.description && (
              <div className="ph-no-capture max-w-[300px] truncate text-xs font-medium text-slate-500">
                {segment.description}
              </div>
            )}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "surveys",
    header: "Surveys",
    cell: ({ row }) => {
      // segments table data row had this hidden on small screens
      return <div className="text-center text-slate-900">{row.original.surveys?.length ?? 0}</div>;
    },
  },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => {
      return (
        <div className="text-center text-slate-900">
          {formatDistanceToNow(row.original.updatedAt, {
            addSuffix: true,
          }).replace("about", "")}
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => {
      return (
        <div className="text-center text-slate-900">
          {format(row.original.createdAt, "do 'of' MMMM, yyyy")}
        </div>
      );
    },
  },
];
