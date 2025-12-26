"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { TFunction } from "i18next";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TUserLocale } from "@formbricks/types/user";
import { timeSince } from "@/lib/time";
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
        <div className={isExpanded ? "break-words whitespace-normal" : "truncate"}>
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

  const updatedAtColumn: ColumnDef<TContactAttributeKey> = {
    id: "updatedAt",
    accessorKey: "updatedAt",
    header: t("common.updated_at"),
    cell: ({ row }) => {
      const updatedAt = row.original.updatedAt;
      return <span>{timeSince(updatedAt.toISOString(), locale)}</span>;
    },
  };

  const baseColumns = [labelColumn, keyColumn, descriptionColumn, createdAtColumn, updatedAtColumn];

  return isReadOnly ? baseColumns : [getSelectionColumn<TContactAttributeKey>(), ...baseColumns];
};
