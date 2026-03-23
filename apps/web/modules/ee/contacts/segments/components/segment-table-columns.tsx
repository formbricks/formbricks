"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format, formatDistanceToNow } from "date-fns";
import { TFunction } from "i18next";
import { UsersIcon } from "lucide-react";
import { TSegmentWithSurveyRefs } from "@formbricks/types/segment";

export const generateSegmentTableColumns = (t: TFunction): ColumnDef<TSegmentWithSurveyRefs>[] => {
  const titleColumn: ColumnDef<TSegmentWithSurveyRefs> = {
    id: "title",
    accessorKey: "title",
    header: t("common.title"),
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <UsersIcon className="h-5 w-5 text-slate-600" />
          </div>
          <div className="flex flex-col">
            <div className="font-medium text-slate-900">{row.original.title}</div>
            {row.original.description && (
              <div className="text-xs text-slate-500">{row.original.description}</div>
            )}
          </div>
        </div>
      );
    },
  };

  const updatedAtColumn: ColumnDef<TSegmentWithSurveyRefs> = {
    id: "updatedAt",
    accessorKey: "updatedAt",
    header: t("common.updated_at"),
    cell: ({ row }) => {
      return (
        <span className="text-sm text-slate-900">
          {formatDistanceToNow(row.original.updatedAt, { addSuffix: true }).replace("about ", "")}
        </span>
      );
    },
  };

  const createdAtColumn: ColumnDef<TSegmentWithSurveyRefs> = {
    id: "createdAt",
    accessorKey: "createdAt",
    header: t("common.created_at"),
    cell: ({ row }) => {
      return (
        <span className="text-sm text-slate-900">{format(row.original.createdAt, "do 'of' MMMM, yyyy")}</span>
      );
    },
  };

  return [titleColumn, updatedAtColumn, createdAtColumn];
};
