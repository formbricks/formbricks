"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Alert } from "@/modules/ui/components/alert";

interface NoFeedbackDirectoryAlertProps {
  organizationId?: string;
}

/** Nothing to chart yet: the workspace has no feedback directory to query. */
export function NoFeedbackDirectoryAlert({ organizationId }: Readonly<NoFeedbackDirectoryAlertProps>) {
  const { t } = useTranslation();

  return (
    <Alert variant="error" size="small" role="status">
      <div>
        <p>{t("workspace.analysis.charts.no_data_source_available")}</p>
        {organizationId && (
          <Link
            className="mt-1 inline-block font-medium underline"
            href={`/organizations/${organizationId}/settings/feedback-directories`}>
            {t("workspace.analysis.charts.go_to_feedback_directories")}
          </Link>
        )}
      </div>
    </Alert>
  );
}
