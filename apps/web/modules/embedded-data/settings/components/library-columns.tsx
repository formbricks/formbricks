"use client";

import type { TFunction } from "i18next";
import { LockIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { TSharedEmbeddedDataListItem } from "@/modules/embedded-data/types";
import { DataTypeBadge } from "@/modules/ui/components/data-type-badge";
import { IdBadge } from "@/modules/ui/components/id-badge";
import type { TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import { FieldRowMenu } from "./field-row-menu";
import { FieldSourceIcon, StatusIcon } from "./field-status";
import { FieldUsageCell } from "./field-usage-cell";

/**
 * The Library table's columns.
 *
 * Defined at module level rather than inside the card: an inline `cell` that returns JSX reads as a
 * nested component definition to Sonar (typescript:S6478).
 *
 * `locked` is not a column of its own. It is a property of the default — a locked field answers with
 * its default and nothing else — so it rides in that cell, and a lock with no default is the one
 * combination worth warning about: the field can then never hold a value at all.
 */
export const getLibraryColumns = ({
  t,
  workspaceId,
  isReadOnly,
  onEdit,
  onDelete,
}: Readonly<{
  t: TFunction;
  workspaceId: string;
  isReadOnly: boolean;
  onEdit: (field: TSharedEmbeddedDataListItem) => void;
  onDelete: (field: TSharedEmbeddedDataListItem) => void;
}>): TSettingsTableColumn<TSharedEmbeddedDataListItem>[] => {
  const columns: TSettingsTableColumn<TSharedEmbeddedDataListItem>[] = [
    {
      id: "name",
      header: t("common.name"),
      headerClassName: "w-[26%]",
      skeletonWidth: "w-32",
      cell: (field) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-slate-800">{field.name}</span>
          {field.description && <span className="text-xs text-slate-500">{field.description}</span>}
        </div>
      ),
    },
    {
      id: "key",
      header: t("common.key"),
      headerClassName: "w-[20%]",
      skeletonWidth: "w-24",
      // The chip copies the key, which is a button inside the row's activator.
      stopRowClick: true,
      // The copy affordance is always drawn rather than revealed on hover: a control that appears
      // under the pointer and takes the chip's width with it makes the column twitch as the cursor
      // crosses the table.
      cell: (field) => <IdBadge id={field.key} />,
    },
    {
      id: "source",
      header: t("workspace.embedded_data.value_source_column"),
      headerClassName: "w-[8%]",
      hideBelow: "md",
      skeletonWidth: "w-8",
      // Icon alone, like the auto-captured table's status columns: the heading says what the column
      // answers, and arrow-in against calculator is a difference you read without a word.
      cell: (field) => <FieldSourceIcon source={field.source} />,
    },
    {
      id: "dataType",
      header: t("common.type"),
      headerClassName: "w-[14%]",
      hideBelow: "md",
      skeletonWidth: "w-16",
      cell: (field) => <DataTypeBadge dataType={field.dataType} />,
    },
    {
      id: "defaultValue",
      header: t("common.default"),
      headerClassName: "w-[16%]",
      hideBelow: "lg",
      skeletonWidth: "w-16",
      cell: (field) => {
        const hasDefault = field.defaultValue !== null;

        return (
          <div className="flex items-center gap-2">
            {hasDefault ? (
              <code className="truncate font-mono text-xs text-slate-800">{String(field.defaultValue)}</code>
            ) : (
              // The dash is what "no default" looks like in a column this narrow — copy all the
              // same, so it comes from the catalog rather than sitting inline, and a locale that
              // marks an absent value differently can say so.
              <span className="text-slate-500">{t("workspace.embedded_data.no_default_placeholder")}</span>
            )}
            {field.locked && (
              <StatusIcon
                icon={LockIcon}
                iconClassName={cn("size-3.5", !hasDefault && "text-warning")}
                label={
                  hasDefault
                    ? t("workspace.embedded_data.locked_description")
                    : t("workspace.embedded_data.locked_without_default")
                }
              />
            )}
          </div>
        );
      },
    },
    {
      id: "usage",
      header: t("workspace.embedded_data.used_in"),
      headerClassName: "w-[12%] whitespace-nowrap",
      skeletonWidth: "w-20",
      // Deliberately **not** `stopRowClick`. That stopped every click in the cell, including the ones
      // on a row with nothing to open, so "Not used" was the one patch of a row that did nothing.
      // The popover trigger stops its own click instead, which leaves the rest of the cell — and the
      // whole of an unused one — behaving like the row around it.
      cell: (field) => (
        <FieldUsageCell fieldId={field.id} workspaceId={workspaceId} surveyCount={field.surveyCount} />
      ),
    },
  ];

  if (!isReadOnly) {
    columns.push({
      id: "actions",
      header: null,
      srLabel: t("common.actions"),
      headerClassName: "w-[6%]",
      stopRowClick: true,
      skeletonWidth: "w-8",
      cell: (field) => (
        // Flex on a wrapper, not on `cellClassName`, which would stop the `<td>` being a table cell.
        <div className="flex justify-end">
          <FieldRowMenu
            fieldName={field.name}
            onEdit={() => onEdit(field)}
            onDelete={() => onDelete(field)}
          />
        </div>
      ),
    });
  }

  return columns;
};
