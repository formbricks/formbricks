"use client";

import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { useRetentionHealth } from "../../hooks/use-retention-health";
import { formatRetentionDate } from "../../lib/display";
import type { TRetentionHealthIssue } from "../../lib/health";

/**
 * What can keep data retention from working, above the tabs, for owners and managers. Shows nothing
 * while loading or when the check itself fails: the banners are advice, and the tabs still work.
 */
export const RetentionHealthAlerts = ({
  organizationId,
  timeZone,
}: Readonly<{ organizationId: string; timeZone: string }>) => {
  const { t, i18n } = useTranslation();
  const { data } = useRetentionHealth({ organizationId });
  if (!data || data.issues.length === 0) return null;

  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const describe = (issue: TRetentionHealthIssue): { title: string; description: string } => {
    switch (issue.code) {
      case "jobsNotConfigured":
        return {
          title: t("workspace.settings.data_retention.health_jobs_title"),
          description: t("workspace.settings.data_retention.health_jobs_description"),
        };
      case "noRecentRun":
        return {
          title: t("workspace.settings.data_retention.health_no_recent_run_title"),
          description: issue.lastRunAt
            ? t("workspace.settings.data_retention.health_no_recent_run_description", {
                date: formatRetentionDate(issue.lastRunAt, locale, timeZone),
              })
            : t("workspace.settings.data_retention.health_never_run_description"),
        };
      case "smtpNotConfigured":
        return {
          title: t("workspace.settings.data_retention.health_smtp_title"),
          description: t("workspace.settings.data_retention.health_smtp_description"),
        };
      case "cleanupBacklog":
        return {
          title: t("workspace.settings.data_retention.health_cleanup_title"),
          description: t("workspace.settings.data_retention.health_cleanup_description", {
            date: formatRetentionDate(issue.oldestAt, locale, timeZone),
          }),
        };
    }
  };

  return (
    <div className="mb-6 space-y-3">
      {data.issues.map((issue) => {
        const { title, description } = describe(issue);
        return (
          <Alert key={issue.code} variant="warning" role="status">
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{description}</AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
};
