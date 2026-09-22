"use client";

import type { TFunction } from "i18next";
import { LockIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import type { TSharedEmbeddedDataListItem } from "@/modules/embedded-data/types";
import { Badge } from "@/modules/ui/components/badge";
import { IdBadge } from "@/modules/ui/components/id-badge";
import type { TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { getDataTypeLabel, getSourceLabel } from "../lib/field-labels";
import { FieldRowMenu } from "./field-row-menu";
import { FieldSourceIcon } from "./field-source-icon";
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
  locale,
  workspaceId,
  isReadOnly,
  onEdit,
  onDelete,
}: Readonly<{
  t: TFunction;
  locale: string;
  workspaceId: string;
  isReadOnly: boolean;
  onEdit: (field: TSharedEmbeddedDataListItem) => void;
  onDelete: (field: TSharedEmbeddedDataListItem) => void;
}>): TSettingsTableColumn<TSharedEmbeddedDataListItem>[] => {
  const columns: TSettingsTableColumn<TSharedEmbeddedDataListItem>[] = [
    {
      id: "name",
      header: t("common.name"),
      headerClassName: "w-[22%]",
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
      headerClassName: "w-[16%]",
      skeletonWidth: "w-24",
      // The chip copies the key, which is a button inside the row's activator.
      stopRowClick: true,
      cell: (field) => <IdBadge id={field.key} showCopyIconOnHover={true} />,
    },
    {
      id: "source",
      header: t("workspace.embedded_data.value_source_column"),
      headerClassName: "w-[14%]",
      hideBelow: "md",
      skeletonWidth: "w-20",
      cell: (field) => (
        // `whitespace-nowrap`: "Passed in" is two words, and a Badge is a pill — wrapping breaks the
        // pill across two lines rather than eliding it.
        <div className="flex items-center gap-2 whitespace-nowrap text-slate-500">
          <FieldSourceIcon source={field.source} />
          <Badge text={getSourceLabel(field.source, t)} type="gray" size="tiny" />
        </div>
      ),
    },
    {
      id: "dataType",
      header: t("common.type"),
      headerClassName: "w-[10%]",
      hideBelow: "md",
      skeletonWidth: "w-16",
      cell: (field) => <Badge text={getDataTypeLabel(field.dataType, t)} type="gray" size="tiny" />,
    },
    {
      id: "defaultValue",
      header: t("common.default"),
      headerClassName: "w-[14%]",
      hideBelow: "lg",
      skeletonWidth: "w-16",
      cell: (field) => {
        const hasDefault = field.defaultValue !== null;

        return (
          <div className="flex items-center gap-2">
            {hasDefault ? (
              <code className="truncate font-mono text-xs text-slate-800">
                {/*
                  The stored literal, deliberately unformatted — which is why it is in mono while the
                  Created column beside it goes through `formatDateForDisplay`. A `date` default is
                  stored and sent as ISO 8601, and it is the exact string a URL parameter carries and
                  the API returns; localising it here would show the author something they cannot
                  type back. The edit dialog renders the same value through a date picker, where a
                  localised reading is the right one because it is being chosen rather than read.
                */}
                {String(field.defaultValue)}
              </code>
            ) : (
              // The dash is what "no default" looks like in a column this narrow — copy all the
              // same, so it comes from the catalog rather than sitting inline, and a locale that
              // marks an absent value differently can say so.
              <span className="text-slate-500">{t("workspace.embedded_data.no_default_placeholder")}</span>
            )}
            {field.locked && (
              <TooltipRenderer
                tooltipContent={
                  hasDefault
                    ? t("workspace.embedded_data.locked_description")
                    : t("workspace.embedded_data.locked_without_default")
                }>
                <LockIcon
                  // `size-4` is the inline icon scale, and `text-warning-muted` clears 3:1 against
                  // white where `text-warning` measures ~2.15:1 — this glyph is the only thing
                  // distinguishing "locked" from "locked with nothing to fall back on".
                  className={cn("size-4 shrink-0", hasDefault ? "text-slate-500" : "text-warning-muted")}
                  aria-label={
                    hasDefault
                      ? t("workspace.embedded_data.locked")
                      : t("workspace.embedded_data.locked_without_default")
                  }
                />
              </TooltipRenderer>
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
      // The cell's trigger opens a popover; a row click behind it would edit the field instead.
      stopRowClick: true,
      cell: (field) => (
        <FieldUsageCell fieldId={field.id} workspaceId={workspaceId} surveyCount={field.surveyCount} />
      ),
    },
    {
      id: "createdAt",
      header: t("common.created_at"),
      headerClassName: "w-[12%] whitespace-nowrap",
      hideBelow: "lg",
      cellClassName: "text-slate-500",
      skeletonWidth: "w-20",
      cell: (field) => formatDateForDisplay(field.createdAt, locale),
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
