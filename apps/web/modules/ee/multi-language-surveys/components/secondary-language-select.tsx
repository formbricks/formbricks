import { useTranslations } from "next-intl";
import type { TLanguage, TProduct } from "@formbricks/types/product";
import type { TSurvey, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { LanguageToggle } from "./language-toggle";

interface SecondaryLanguageSelectProps {
  product: TProduct;
  defaultLanguage: TLanguage;
  setSelectedLanguageCode: (languageCode: string) => void;
  setActiveQuestionId: (questionId: TSurveyQuestionId) => void;
  localSurvey: TSurvey;
  updateSurveyLanguages: (language: TLanguage) => void;
  locale: TUserLocale;
}

export function SecondaryLanguageSelect({
  product,
  defaultLanguage,
  setSelectedLanguageCode,
  setActiveQuestionId,
  localSurvey,
  updateSurveyLanguages,
  locale,
}: SecondaryLanguageSelectProps) {
  const t = useTranslations();
  const isLanguageToggled = (language: TLanguage) => {
    return localSurvey.languages.some(
      (surveyLanguage) => surveyLanguage.language.code === language.code && surveyLanguage.enabled
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm">
        {t("environments.surveys.edit.2_activate_translation_for_specific_languages")}:
      </p>
      {product.languages
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
