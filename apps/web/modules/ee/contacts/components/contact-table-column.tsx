"use client";

import { ColumnDef } from "@tanstack/react-table";
import { TFunction } from "i18next";
import { formatAttributeValue } from "@/modules/ee/contacts/lib/format-attribute-value";
import { getSelectionColumn } from "@/modules/ui/components/data-table";
import { HighlightedText } from "@/modules/ui/components/highlighted-text";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { TContactTableData } from "../types/contact";

export const generateContactTableColumns = (
  searchValue: string,
  data: TContactTableData[],
  isReadOnly: boolean,
  t: TFunction
): ColumnDef<TContactTableData>[] => {
  const userColumn: ColumnDef<TContactTableData> = {
    id: "contactsTableUser",
    accessorKey: "contactsTableUser",
    header: t("common.id"),
    cell: ({ row }) => {
      const contactId = row.original.id;
      return <HighlightedText value={contactId} searchValue={searchValue} />;
    },
  };

  const userIdColumn: ColumnDef<TContactTableData> = {
    id: "userId",
    accessorKey: "userId",
    header: t("common.user_id"),
    cell: ({ row }) => {
      const userId = row.original.userId;
      return <IdBadge id={userId} />;
    },
  };

  const emailColumn: ColumnDef<TContactTableData> = {
    id: "email",
    accessorKey: "email",
    header: t("common.email"),
    cell: ({ row }) => {
      const email = row.original.email;
      if (email) {
        return <HighlightedText value={email} searchValue={searchValue} />;
      }
    },
  };

  const firstNameColumn: ColumnDef<TContactTableData> = {
    id: "firstName",
    accessorKey: "firstName",
    header: t("common.first_name"),
    cell: ({ row }) => {
      const firstName = row.original.firstName;
      return <HighlightedText value={firstName} searchValue={searchValue} />;
    },
  };

  const lastNameColumn: ColumnDef<TContactTableData> = {
    id: "lastName",
    accessorKey: "lastName",
    header: t("common.last_name"),
    cell: ({ row }) => {
      const lastName = row.original.lastName;
      return <HighlightedText value={lastName} searchValue={searchValue} />;
    },
  };

  const restCols = data[0]?.attributes
    ? data[0].attributes.map((attr) => {
        return {
          id: attr.key,
          accessorKey: attr.key,
          header: attr.name ?? attr.key,
          cell: ({ row }) => {
            const attribute = row.original.attributes.find((a) => a.key === attr.key);
            if (!attribute) return null;
            const formattedValue = formatAttributeValue(attribute.value, attribute.dataType);
            return <HighlightedText value={formattedValue} searchValue={searchValue} />;
          },
        };
      })
    : [];

  const baseColumns = [userColumn, userIdColumn, emailColumn, firstNameColumn, lastNameColumn, ...restCols];

  return isReadOnly ? baseColumns : [getSelectionColumn(), ...baseColumns];
};
