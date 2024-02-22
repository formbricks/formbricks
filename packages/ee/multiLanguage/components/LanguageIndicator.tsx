import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { TSurveyLanguage } from "@formbricks/types/surveys";

import { getLanguageLabel } from "../lib/isoLanguages";

interface LanguageIndicatorProps {
  selectedLanguageCode: string;
  surveyLanguages: TSurveyLanguage[];
  setSelectedLanguageCode: (languageCode: string) => void;
}
export function LanguageIndicator({
  surveyLanguages,
  selectedLanguageCode,
  setSelectedLanguageCode,
}: LanguageIndicatorProps) {
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  const toggleDropdown = () => setShowLanguageDropdown((prev) => !prev);

  const changeLanguage = (language: TSurveyLanguage) => {
    setSelectedLanguageCode(language.language.code);
    setShowLanguageDropdown(false);
  };
  const langaugeToBeDisplayed = surveyLanguages.find((language) => {
    return selectedLanguageCode === "default"
      ? language.default === true
      : language.language.code === selectedLanguageCode;
  });

  return (
    <div className="absolute right-2 top-2 z-50">
      <button
        type="button"
        className="flex items-center justify-center rounded-md bg-slate-900 p-1 px-2 text-xs text-white hover:bg-slate-700"
        onClick={toggleDropdown}
        aria-haspopup="true"
        aria-expanded={showLanguageDropdown}>
        {langaugeToBeDisplayed ? getLanguageLabel(langaugeToBeDisplayed?.language.code) : ""}
        <ChevronDown className="ml-1 h-4 w-4" />
      </button>
      {showLanguageDropdown && (
        <div className="absolute right-0 mt-1 space-y-2 rounded-md bg-slate-900 p-2 text-xs text-white hover:bg-slate-700">
          {surveyLanguages.map(
            (language) =>
              language.language.code !== langaugeToBeDisplayed?.language.code && (
                <button
                  key={language.language.id}
                  type="button"
                  className="m-0 block w-full text-left"
                  onClick={() => changeLanguage(language)}>
                  {getLanguageLabel(language.language.code)}
                </button>
              )
          )}
        </div>
      )}
    </div>
  );
}
