"use client";

import type { TFunction } from "i18next";
import { DataTypeBadge } from "@/modules/ui/components/data-type-badge";
import type { TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import type { TAutoCapturedField } from "../lib/auto-captured-fields";
import { FieldAvailabilityIcon, FieldPrivacyIcon } from "./field-status";

/**
 * The Auto-captured table's columns.
 *
 * Module level for the same reason as the Library's (see library-columns.tsx): an inline `cell` that
 * returns JSX reads as a nested component definition to Sonar (typescript:S6478).
 *
 * The two status columns are glyphs, not sentences: the heading says what the column is about, so
 * the cell only has to say which of three answers this row gives (see field-status.tsx).
 */
export const getAutoCapturedColumns = (t: TFunction): TSettingsTableColumn<TAutoCapturedField>[] => [
  {
    id: "name",
    header: t("common.name"),
    headerClassName: "w-[34%]",
    cellClassName: "font-medium text-slate-800",
    cell: (field) => field.label,
  },
  {
    id: "dataType",
    header: t("common.type"),
    headerClassName: "w-[22%]",
    hideBelow: "sm",
    cell: (field) => <DataTypeBadge dataType={field.dataType} />,
  },
  {
    id: "availability",
    header: t("workspace.embedded_data.in_logic_and_recall"),
    headerClassName: "w-[22%] whitespace-nowrap",
    cell: (field) => <FieldAvailabilityIcon availability={field.availability} />,
  },
  {
    id: "privacy",
    header: t("workspace.embedded_data.when_anonymized"),
    headerClassName: "w-[22%] whitespace-nowrap",
    hideBelow: "sm",
    cell: (field) => <FieldPrivacyIcon privacy={field.privacy} />,
  },
];
