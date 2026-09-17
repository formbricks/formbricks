"use client";

import type { TFunction } from "i18next";
import { Badge } from "@/modules/ui/components/badge";
import type { TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import type { TAutoCapturedField } from "../lib/auto-captured-fields";
import { getAvailabilityLabel, getDataTypeLabel, getPrivacyLabel } from "./field-labels";

/**
 * The Auto-captured table's columns.
 *
 * Module level for the same reason as the Library's (see library-columns.tsx): an inline `cell` that
 * returns JSX reads as a nested component definition to Sonar (typescript:S6478).
 */
export const getAutoCapturedColumns = (t: TFunction): TSettingsTableColumn<TAutoCapturedField>[] => [
  {
    id: "name",
    header: t("common.name"),
    headerClassName: "w-[30%]",
    cellClassName: "font-medium text-slate-800",
    cell: (field) => field.label,
  },
  {
    id: "dataType",
    header: t("common.type"),
    headerClassName: "w-[16%]",
    hideBelow: "sm",
    cell: (field) => <Badge text={getDataTypeLabel(field.dataType, t)} type="gray" size="tiny" />,
  },
  {
    id: "availability",
    header: t("workspace.embedded_data.in_logic_and_recall"),
    headerClassName: "w-[27%]",
    cellClassName: "text-slate-500",
    cell: (field) => getAvailabilityLabel(field.availability, t),
  },
  {
    id: "privacy",
    header: t("workspace.embedded_data.when_anonymized"),
    headerClassName: "w-[27%]",
    cellClassName: "text-slate-500",
    hideBelow: "sm",
    cell: (field) => getPrivacyLabel(field.privacy, t),
  },
];
