"use client";

import { Language } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import type { TSurvey, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { LanguageToggle } from "./language-toggle";

interface SecondaryLanguageSelectProps {
  projectLanguages: Language[];
  defaultLanguage: Language;
  setSelectedLanguageCode: (languageCode: string) => void;
  setActiveQuestionId: (questionId: TSurveyQuestionId) => void;
  localSurvey: TSurvey;
  updateSurveyLanguages: (language: Language) => void;
  locale: TUserLocale;
}

export function SecondaryLanguageSelect({
  projectLanguages,
  defaultLanguage,
  setSelectedLanguageCode,
  setActiveQuestionId,
  localSurvey,
  updateSurveyLanguages,
  locale,
}: SecondaryLanguageSelectProps) {
  const { t } = useTranslate();
  const isLanguageToggled = (language: Language) => {
    return localSurvey.languages.some(
      (surveyLanguage) => surveyLanguage.language.code === language.code && surveyLanguage.enabled
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm">
        {t("environments.surveys.edit.2_activate_translation_for_specific_languages")}:
      </p>
      {projectLanguages
        .filter((lang) => lang.id !== defaultLanguage.id)
        .map((language) => (
          <LanguageToggle
            isChecked={isLanguageToggled(language)}
            key={language.id}
            language={language}
            onEdit={() => {
              setSelectedLanguageCode(language.code);
              setActiveQuestionId(localSurvey.questions[0]?.id);
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
