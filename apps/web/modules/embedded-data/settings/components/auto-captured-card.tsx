"use client";

import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { SettingsTable } from "@/modules/ui/components/settings-table";
import { getAutoCapturedFields } from "../lib/auto-captured-fields";
import { getAutoCapturedColumns } from "./auto-captured-columns";

/**
 * The second card: what every response already carries.
 *
 * Read-only for everyone, not just read-only members — these are a code catalog rather than rows, so
 * there is nothing to edit and nothing to add to a survey. The table is projected from that catalog
 * (see lib/auto-captured-fields.ts) so it cannot fall behind the fields actually captured.
 */
export const AutoCapturedCard = () => {
  const { t } = useTranslation();

  const columns = getAutoCapturedColumns(t);

  return (
    <SettingsCard
      title={t("workspace.embedded_data.auto_captured")}
      description={t("workspace.embedded_data.auto_captured_description")}
      bodyVariant="flush">
      <SettingsTable
        columns={columns}
        rows={getAutoCapturedFields(t)}
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
