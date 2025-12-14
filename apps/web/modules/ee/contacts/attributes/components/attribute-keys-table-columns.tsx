"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format, formatDistanceToNow } from "date-fns";
import { Calendar1Icon, HashIcon, TagIcon } from "lucide-react";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { Badge } from "@/modules/ui/components/badge";
import { getSelectionColumn } from "@/modules/ui/components/data-table";
import { IdBadge } from "@/modules/ui/components/id-badge";

const getIconForDataType = (dataType: string) => {
  switch (dataType) {
    case "date":
      return <Calendar1Icon className="h-4 w-4 text-slate-600" />;
    case "number":
      return <HashIcon className="h-4 w-4 text-slate-600" />;
    default:
      return <TagIcon className="h-4 w-4 text-slate-600" />;
  }
};

export const generateAttributeKeysTableColumns = (isReadOnly: boolean): ColumnDef<TContactAttributeKey>[] => {
  const nameColumn: ColumnDef<TContactAttributeKey> = {
    id: "name",
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      const name = row.original.name || row.original.key;
      return <span className="font-medium text-slate-900">{name}</span>;
    },
  };

  const keyColumn: ColumnDef<TContactAttributeKey> = {
    id: "key",
    accessorKey: "key",
    header: "Key",
    cell: ({ row }) => {
      return <IdBadge id={row.original.key} />;
    },
  };

  const dataTypeColumn: ColumnDef<TContactAttributeKey> = {
    id: "dataType",
    accessorKey: "dataType",
    header: "Data Type",
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-2">
          {getIconForDataType(row.original.dataType)}
          <Badge text={row.original.dataType} type="gray" size="tiny" />
        </div>
      );
    },
  };

  const descriptionColumn: ColumnDef<TContactAttributeKey> = {
    id: "description",
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      return <span className="text-sm text-slate-600">{row.original.description || "—"}</span>;
    },
  };

  const createdAtColumn: ColumnDef<TContactAttributeKey> = {
    id: "createdAt",
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => {
      return (
        <span className="text-sm text-slate-900">{format(row.original.createdAt, "do 'of' MMMM, yyyy")}</span>
      );
    },
  };

  const updatedAtColumn: ColumnDef<TContactAttributeKey> = {
    id: "updatedAt",
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => {
      return (
        <span className="text-sm text-slate-900">
          {formatDistanceToNow(row.original.updatedAt, { addSuffix: true }).replace("about ", "")}
        </span>
      );
    },
  };

  const baseColumns = [
    nameColumn,
    keyColumn,
    dataTypeColumn,
    descriptionColumn,
    createdAtColumn,
    updatedAtColumn,
  ];

  return isReadOnly ? baseColumns : [getSelectionColumn(), ...baseColumns];
};
