"use client";

import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import { type TAutoCapturedField, getAutoCapturedFields } from "../lib/auto-captured-fields";
import { getAvailabilityLabel, getDataTypeLabel, getPrivacyLabel } from "./field-display";

/**
 * The second card: what every response already carries.
 *
 * Read-only for everyone, not just read-only members — these are a code catalog rather than rows, so
 * there is nothing to edit and nothing to add to a survey. The table is projected from that catalog
 * (see lib/auto-captured-fields.ts) so it cannot fall behind the fields actually captured.
 */
export const AutoCapturedCard = () => {
  const { t } = useTranslation();

  const columns: TSettingsTableColumn<TAutoCapturedField>[] = [
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

  return (
    <SettingsCard
      title={t("workspace.embedded_data.auto_captured")}
      description={t("workspace.embedded_data.auto_captured_description")}
      bodyVariant="flush">
      <SettingsTable
        columns={columns}
        rows={getAutoCapturedFields()}
        getRowId={(field) => field.name}
        emptyMessage={t("common.no_results")}
        aria-label={t("workspace.embedded_data.auto_captured")}
        footer={
          <div className="p-4">
            {/* Visible on first paint, so `status` rather than the assertive `alert` live region. */}
            <Alert variant="info" role="status">
              <AlertDescription>{t("workspace.embedded_data.anonymize_note")}</AlertDescription>
            </Alert>
          </div>
        }
      />
    </SettingsCard>
  );
};
