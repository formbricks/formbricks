"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";
import { Alert, AlertButton, AlertDescription } from "@/modules/ui/components/alert";
import { useSurveyRetention } from "../../hooks/use-survey-retention";
import {
  formatRetentionDate,
  getSurveyRetentionDueWarning,
  getSurveyRetentionExemptLines,
} from "../../lib/display";
import { DataRetentionQueryClientProvider } from "../query-client-provider";

interface SurveyRetentionNoteProps {
  surveyId: string;
  organizationId: string;
  timeZone: string;
}

const SurveyRetentionNoteContent = ({
  surveyId,
  organizationId,
  timeZone,
}: Readonly<SurveyRetentionNoteProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  // Failing quietly is right here: the note is a pointer, and its absence hides nothing the policies page doesn't show.
  const { data: retention } = useSurveyRetention({ surveyId });
  if (!retention?.governed) return null;

  const formatDate = (iso: string) => formatRetentionDate(iso, locale, timeZone);
  const warning = getSurveyRetentionDueWarning(retention, t, locale, formatDate);
  const exemptLines = getSurveyRetentionExemptLines(retention, t, formatDate);

  // Both are statuses, not alerts: they are there on load, not news that should interrupt a screen reader.
  // Both wrap instead of the small alert's truncation, so exemption lines and the due date stay readable.
  return (
    <div className="mb-4 space-y-2">
      <Alert variant="info" size="small" role="status">
        <AlertDescription className="whitespace-normal">
          {[t("workspace.settings.data_retention.survey_note"), ...exemptLines].join(" ")}
        </AlertDescription>
        <AlertButton asChild>
          <Link href={organizationSettingsPath(organizationId, "data-retention/policies")}>
            {t("workspace.settings.data_retention.view_policies")}
          </Link>
        </AlertButton>
      </Alert>
      {warning ? (
        <Alert variant="warning" size="small" role="status">
          <AlertDescription className="whitespace-normal">{warning}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
};

/**
 * The survey summary's data retention note (ENG-3610): one quiet line on every survey a policy reaches,
 * and a dated warning while responses are inside the notice window. Rendered only when the
 * organisation is entitled; it renders nothing for a survey no active policy reaches.
 */
export const SurveyRetentionNote = (props: Readonly<SurveyRetentionNoteProps>) => (
  <DataRetentionQueryClientProvider>
    <SurveyRetentionNoteContent {...props} />
  </DataRetentionQueryClientProvider>
);
