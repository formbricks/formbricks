"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useOrganization } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { useSurveyRetention } from "../../hooks/use-survey-retention";
import { formatRetentionDate, getSurveyExemptionEnd } from "../../lib/display";
import { DataRetentionQueryClientProvider } from "../query-client-provider";

interface ArchiveSurveyRetentionWarningProps {
  surveyId: string;
}

const ArchiveSurveyRetentionWarningContent = ({ surveyId }: Readonly<ArchiveSurveyRetentionWarningProps>) => {
  const { t, i18n } = useTranslation();
  const { organization } = useOrganization();
  // The dialog lives seconds, so the time it opened is "now" for the whole of it.
  const [now] = useState(() => new Date());
  // Loading or failing shows today's text: the warning never blocks archiving.
  const { data: retention } = useSurveyRetention({ surveyId });
  const exemptionEnd = retention ? getSurveyExemptionEnd(retention.exemptions, now) : null;

  if (!exemptionEnd) return <p>{t("workspace.surveys.archive_survey_warning")}</p>;

  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const date = formatRetentionDate(exemptionEnd, locale, getReportingTimeZone(organization?.displayTimeZone));
  return <p>{t("workspace.surveys.archive_survey_warning_exempt", { date })}</p>;
};

/**
 * The archive dialog's deletion warning (ENG-3991). A survey held by a retention exemption is deleted
 * 30 days after the exemption ends, not 30 days after archiving, so it says so with the end date.
 * Mount it only while the dialog is open: it fetches the survey's retention.
 */
export const ArchiveSurveyRetentionWarning = (props: Readonly<ArchiveSurveyRetentionWarningProps>) => (
  <DataRetentionQueryClientProvider>
    <ArchiveSurveyRetentionWarningContent {...props} />
  </DataRetentionQueryClientProvider>
);
