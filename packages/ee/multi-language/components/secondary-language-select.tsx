import type { TLanguage, TProduct } from "@formbricks/types/product";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { LanguageToggle } from "./language-toggle";

interface SecondaryLanguageSelectProps {
  product: TProduct;
  defaultLanguage: TLanguage;
  setSelectedLanguageCode: (languageCode: string) => void;
  setActiveQuestionId: (questionId: string) => void;
  localSurvey: TSurvey;
  updateSurveyLanguages: (language: TLanguage) => void;
}

export function SecondaryLanguageSelect({
  product,
  defaultLanguage,
  setSelectedLanguageCode,
  setActiveQuestionId,
  localSurvey,
  updateSurveyLanguages,
}: SecondaryLanguageSelectProps) {
  const isLanguageToggled = (language: TLanguage) => {
    return localSurvey.languages.some(
      (surveyLanguage) => surveyLanguage.language.code === language.code && surveyLanguage.enabled
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm">2. Activate translation for specific languages:</p>
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
          />
        ))}
    </div>
  );
}
