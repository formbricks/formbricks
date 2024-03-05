import { TLanguage, TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";

import { LanguageToggle } from "./LanguageToggle";

interface secondaryLanguageSelectProps {
  product: TProduct;
  defaultLanguage: TLanguage;
  surveyLanguageCodes: string[];
  setSelectedLanguageCode: (languageCode: string) => void;
  setActiveQuestionId: (questionId: string) => void;
  localSurvey: TSurvey;
  updateSurveyLanguages: (language: TLanguage) => void;
}

export const SecondaryLanguageSelect = ({
  product,
  defaultLanguage,
  surveyLanguageCodes,
  setSelectedLanguageCode,
  setActiveQuestionId,
  localSurvey,
  updateSurveyLanguages,
}: secondaryLanguageSelectProps) => {
  return (
    <div className="space-y-4">
      <p className="text-sm">2. Activate translation for specific languages:</p>
      {product.languages
        .filter((lang) => lang.id !== defaultLanguage.id)
        .map((language) => (
          <LanguageToggle
            key={language.id}
            language={language}
            isChecked={surveyLanguageCodes.includes(language.code)}
            onToggle={() => updateSurveyLanguages(language)}
            onEdit={() => {
              setSelectedLanguageCode(language.code);
              setActiveQuestionId(localSurvey.questions[0]?.id);
            }}
          />
        ))}
    </div>
  );
};
