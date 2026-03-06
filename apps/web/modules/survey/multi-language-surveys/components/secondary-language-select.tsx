"use client";

import { Language } from "@prisma/client";
import { useTranslation } from "react-i18next";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { LanguageToggle } from "./language-toggle";

interface SecondaryLanguageSelectProps {
  projectLanguages: Language[];
  defaultLanguage: Language;
  setSelectedLanguageCode: (languageCode: string) => void;
  setActiveElementId: (elementId: string) => void;
  localSurvey: TSurvey;
  updateSurveyLanguages: (language: Language) => void;
  locale: TUserLocale;
}

export function SecondaryLanguageSelect({
  projectLanguages,
  defaultLanguage,
  setSelectedLanguageCode,
  setActiveElementId,
  localSurvey,
  updateSurveyLanguages,
  locale,
}: SecondaryLanguageSelectProps) {
  const { t } = useTranslation();
  const isLanguageToggled = (language: Language) => {
    return localSurvey.languages.some(
      (surveyLanguage) => surveyLanguage.language.code === language.code && surveyLanguage.enabled
    );
  };

  const elements = getElementsFromBlocks(localSurvey.blocks);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-800">
        {t("environments.surveys.edit.2_activate_translation_for_specific_languages")}
      </p>{" "}
      {projectLanguages
        .filter((lang) => lang.id !== defaultLanguage.id)
        .map((language) => (
          <LanguageToggle
            isChecked={isLanguageToggled(language)}
            key={language.id}
            language={language}
            onEdit={() => {
              setSelectedLanguageCode(language.code);
              setActiveElementId(elements[0]?.id);
            }}
            onToggle={() => {
              updateSurveyLanguages(language);
            }}
            locale={locale}
          />
        ))}
    </div>
  );
}
