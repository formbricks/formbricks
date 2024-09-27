"use client";

import { ColumnDef } from "@tanstack/react-table";
import { cn } from "@formbricks/lib/cn";
import { TPersonTableData } from "@formbricks/types/people";
import { getSelectionColumn } from "@formbricks/ui/components/DataTable";
import { HighlightedText } from "@formbricks/ui/components/HighlightedText";

export const generatePersonTableColumns = (
  isExpanded: boolean,
  searchValue: string
): ColumnDef<TPersonTableData>[] => {
  const dateColumn: ColumnDef<TPersonTableData> = {
    accessorKey: "createdAt",
    header: () => "Date",
    cell: ({ row }) => {
      const isoDateString = row.original.createdAt;
      const date = new Date(isoDateString);

      const formattedDate = date.toLocaleString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const formattedTime = date.toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      return (
        <div>
          <p className="truncate text-slate-900">{formattedDate}</p>
          <p className="truncate text-slate-900">{formattedTime}</p>
        </div>
      );
    },
  };

  const userColumn: ColumnDef<TPersonTableData> = {
    accessorKey: "user",
    header: "User",
    cell: ({ row }) => {
      const personId = row.original.personId;
      return <HighlightedText value={personId} searchValue={searchValue} />;
    },
  };

  const userIdColumn: ColumnDef<TPersonTableData> = {
    accessorKey: "userId",
    header: "User ID",
    cell: ({ row }) => {
      const userId = row.original.userId;
      return <HighlightedText value={userId} searchValue={searchValue} />;
    },
  };

  const emailColumn: ColumnDef<TPersonTableData> = {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => {
      const email = row.original.attributes.email;
      if (email) {
        return <HighlightedText value={email} searchValue={searchValue} />;
      }
    },
  };

  const attributesColumn: ColumnDef<TPersonTableData> = {
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

  return [getSelectionColumn(), dateColumn, userColumn, userIdColumn, emailColumn, attributesColumn];
};
