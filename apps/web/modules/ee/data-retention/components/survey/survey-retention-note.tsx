"use client";

import { HourglassIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { useSurveyRetention } from "../../hooks/use-survey-retention";
import { formatRetentionDate, getSurveyRetentionDueWarning } from "../../lib/display";
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

  const warning = getSurveyRetentionDueWarning(retention, t, locale, (iso) =>
    formatRetentionDate(iso, locale, timeZone)
  );

  return (
    <div className="mb-4 space-y-2">
      <p className="flex items-center gap-1.5 text-sm text-slate-500">
        <HourglassIcon className="size-3.5 shrink-0" aria-hidden />
        {t("workspace.settings.data_retention.survey_note")}{" "}
        <Link
          href={organizationSettingsPath(organizationId, "data-retention/policies")}
          className="font-medium text-slate-700 underline-offset-2 hover:underline">
          {t("workspace.settings.data_retention.view_policies")}
        </Link>
      </p>
      {warning ? (
        // A status, not an alert: it is there on load, not news that should interrupt a screen reader.
        <Alert variant="warning" role="status">
          <AlertDescription>{warning}</AlertDescription>
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
