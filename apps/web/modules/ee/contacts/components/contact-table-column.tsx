"use client";

import { getSelectionColumn } from "@/modules/ui/components/data-table";
import { HighlightedText } from "@/modules/ui/components/highlighted-text";
import { ColumnDef } from "@tanstack/react-table";
import { TContactTableData } from "../types/contact";

export const generateContactTableColumns = (
  searchValue: string,
  data: TContactTableData[],
  isReadOnly: boolean
): ColumnDef<TContactTableData>[] => {
  const userColumn: ColumnDef<TContactTableData> = {
    id: "contactsTableUser",
    accessorKey: "contactsTableUser",
    header: "ID",
    cell: ({ row }) => {
      const contactId = row.original.id;
      return <HighlightedText value={contactId} searchValue={searchValue} />;
    },
  };

  const userIdColumn: ColumnDef<TContactTableData> = {
    id: "userId",
    accessorKey: "userId",
    header: "User ID",
    cell: ({ row }) => {
      const userId = row.original.userId;
      return <HighlightedText value={userId} searchValue={searchValue} />;
    },
  };

  const emailColumn: ColumnDef<TContactTableData> = {
    id: "email",
    accessorKey: "email",
    header: "Email",
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
    header: "First Name",
    cell: ({ row }) => {
      const firstName = row.original.firstName;
      return <HighlightedText value={firstName} searchValue={searchValue} />;
    },
  };

  const lastNameColumn: ColumnDef<TContactTableData> = {
    id: "lastName",
    accessorKey: "lastName",
    header: "Last Name",
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
            return <HighlightedText value={attribute?.value} searchValue={searchValue} />;
          },
        };
      })
    : [];

  const baseColumns = [userColumn, userIdColumn, emailColumn, firstNameColumn, lastNameColumn, ...restCols];

  return isReadOnly ? baseColumns : [getSelectionColumn(), ...baseColumns];
};
