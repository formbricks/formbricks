"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { TFunction } from "i18next";
import { CalendarIcon, HashIcon, TagIcon } from "lucide-react";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TUserLocale } from "@formbricks/types/user";
import { timeSince } from "@/lib/time";
import { Badge } from "@/modules/ui/components/badge";
import { getSelectionColumn } from "@/modules/ui/components/data-table";
import { HighlightedText } from "@/modules/ui/components/highlighted-text";
import { IdBadge } from "@/modules/ui/components/id-badge";

export const generateAttributeTableColumns = (
  searchValue: string,
  isReadOnly: boolean,
  isExpanded: boolean,
  t: TFunction,
  locale: TUserLocale
): ColumnDef<TContactAttributeKey>[] => {
  const labelColumn: ColumnDef<TContactAttributeKey> = {
    id: "name",
    accessorKey: "name",
    header: t("common.label"),
    cell: ({ row }) => {
      const name = row.original.name ?? row.original.key;
      return <HighlightedText value={name} searchValue={searchValue} />;
    },
  };

  const keyColumn: ColumnDef<TContactAttributeKey> = {
    id: "key",
    accessorKey: "key",
    header: t("common.key"),
    cell: ({ row }) => {
      const key = row.original.key;
      return <IdBadge id={key} showCopyIconOnHover={true} />;
    },
  };

  const descriptionColumn: ColumnDef<TContactAttributeKey> = {
    id: "description",
    accessorKey: "description",
    header: t("common.description"),
    cell: ({ row }) => {
      const description = row.original.description;
      return description ? (
        <div className={isExpanded ? "whitespace-normal break-words" : "truncate"}>
          <HighlightedText value={description} searchValue={searchValue} />
        </div>
      ) : (
        <span className="text-slate-400">-</span>
      );
    },
  };

  const createdAtColumn: ColumnDef<TContactAttributeKey> = {
    id: "createdAt",
    accessorKey: "createdAt",
    header: t("common.created_at"),
    cell: ({ row }) => {
      const createdAt = row.original.createdAt;
      return <span>{format(createdAt, "do 'of' MMMM, yyyy")}</span>;
    },
  };

  const dataTypeColumn: ColumnDef<TContactAttributeKey> = {
    id: "dataType",
    accessorKey: "dataType",
    header: t("environments.contacts.data_type"),
    cell: ({ row }) => {
      const dataType = row.original.dataType;
      const getIcon = () => {
        switch (dataType) {
          case "date":
            return <CalendarIcon className="h-4 w-4" />;
          case "number":
            return <HashIcon className="h-4 w-4" />;
          case "string":
          default:
            return <TagIcon className="h-4 w-4" />;
        }
      };

      const getLabel = () => {
        switch (dataType) {
          case "date":
            return t("common.date");
          case "number":
            return t("common.number");
          case "string":
          default:
            return t("common.text");
        }
      };

      return (
        <div className="flex items-center gap-2">
          <span className="text-slate-500">{getIcon()}</span>
          <Badge type="gray" size="normal" text={getLabel()} />
        </div>
      );
    },
  };

  const updatedAtColumn: ColumnDef<TContactAttributeKey> = {
    id: "updatedAt",
    accessorKey: "updatedAt",
    header: t("common.updated_at"),
    cell: ({ row }) => {
      const updatedAt = row.original.updatedAt;
      return <span>{timeSince(updatedAt.toISOString(), locale)}</span>;
    },
  };

  const baseColumns = [
    createdAtColumn,
    labelColumn,
    keyColumn,
    descriptionColumn,
    dataTypeColumn,
    updatedAtColumn,
  ];

  return isReadOnly ? baseColumns : [getSelectionColumn<TContactAttributeKey>(), ...baseColumns];
};
