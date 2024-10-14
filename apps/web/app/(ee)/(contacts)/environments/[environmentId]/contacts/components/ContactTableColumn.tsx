"use client";

import { ColumnDef } from "@tanstack/react-table";
import { cn } from "@formbricks/lib/cn";
import { getSelectionColumn } from "@formbricks/ui/components/DataTable";
import { HighlightedText } from "@formbricks/ui/components/HighlightedText";
import { TContactTableData } from "../types/contact";

export const generateContactTableColumns = (
  isExpanded: boolean,
  searchValue: string
): ColumnDef<TContactTableData>[] => {
  const userColumn: ColumnDef<TContactTableData> = {
    accessorKey: "user",
    header: "User",
    cell: ({ row }) => {
      const contactId = row.original.id;
      return <HighlightedText value={contactId} searchValue={searchValue} />;
    },
  };

  const userIdColumn: ColumnDef<TContactTableData> = {
    accessorKey: "userId",
    header: "User ID",
    cell: ({ row }) => {
      const userId = row.original.userId;
      return <HighlightedText value={userId} searchValue={searchValue} />;
    },
  };

  const emailColumn: ColumnDef<TContactTableData> = {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => {
      const email = row.original.attributes.email;
      if (email) {
        return <HighlightedText value={email} searchValue={searchValue} />;
      }
    },
  };

  const firstNameColumn: ColumnDef<TContactTableData> = {
    accessorKey: "firstName",
    header: "First Name",
    cell: ({ row }) => {
      const firstName = row.original.firstName;
      return <HighlightedText value={firstName} searchValue={searchValue} />;
    },
  };

  const lastNameColumn: ColumnDef<TContactTableData> = {
    accessorKey: "lastName",
    header: "Last Name",
    cell: ({ row }) => {
      const lastName = row.original.lastName;
      return <HighlightedText value={lastName} searchValue={searchValue} />;
    },
  };

  const attributesColumn: ColumnDef<TContactTableData> = {
    accessorKey: "attributes",
    header: "Attributes",
    cell: ({ row }) => {
      const attributes = row.original.attributes;

      // Handle cases where attributes are missing or empty
      if (!attributes || Object.keys(attributes).length === 0) return null;

      return (
        <div className={cn(!isExpanded && "flex space-x-2")}>
          {Object.entries(attributes).map(([key, value]) => (
            <div key={key} className="flex space-x-2">
              <div className="font-semibold">{key}</div> :{" "}
              <HighlightedText value={value} searchValue={searchValue} />
            </div>
          ))}
        </div>
      );
    },
  };

  return [
    getSelectionColumn(),
    userColumn,
    userIdColumn,
    emailColumn,
    firstNameColumn,
    lastNameColumn,
    attributesColumn,
  ];
};
