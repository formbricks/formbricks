"use client";

import { AlertTriangleIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/utils";
import type { TDestinationSurveyOption } from "../../lib/destination-options";
import type { TCreativeLanguagesForm } from "../../lib/editor-form";
import { getLanguagesMissingFromSurvey } from "../../lib/languages-form";
import { getUiLocale } from "../../lib/ui-locale";

/**
 * Warns when the Destination survey lacks one of the creative's languages (ENG-4003): an app survey in
 * several languages hides the creative for visitors in it, any other opens in its default language.
 * Styled like the On click panel's other survey notes.
 */
export const SurveyLanguageWarning = ({
  languages,
  survey,
}: Readonly<{ languages: TCreativeLanguagesForm; survey: TDestinationSurveyOption | null }>) => {
  const { t, i18n } = useTranslation();
  const missing = getLanguagesMissingFromSurvey(
    languages,
    survey?.languages ? { type: survey.type, languages: survey.languages } : null
  );
  if (!survey || !missing) return null;

  const locale = getUiLocale(i18n);
  const names = missing.codes.map((code) => getLanguageLabel(code, locale) ?? code).join(", ");
  const values = { survey: survey.name, languages: names };

  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <AlertTriangleIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      {missing.effect === "hidden"
        ? t("workspace.creatives.editor.survey_language_missing_hidden", values)
        : t("workspace.creatives.editor.survey_language_missing_default", values)}
    </p>
  );
};
