import { LanguageIcon } from "@heroicons/react/24/solid";
import { useState } from "react";

import { TLanguage } from "@formbricks/types/product";

interface LanguageIndicatorProps {
  selectedLanguage: string;
  surveyLanguages: TLanguage[];
  setSelectedLanguage: (language: string) => void;
}
export function LanguageIndicator({
  selectedLanguage,
  surveyLanguages,
  setSelectedLanguage,
}: LanguageIndicatorProps) {
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  const toggleDropdown = () => setShowLanguageDropdown((prev) => !prev);

  const changeLanguage = (language: TLanguage) => {
    setSelectedLanguage(language.id);
    setShowLanguageDropdown(false);
  };
  const langaugeToBeDisplayed = surveyLanguages.find((language) => language.id === selectedLanguage);

  return (
    <div className="absolute right-2 top-2 z-50">
      <button
        type="button"
        className="flex items-center justify-center rounded-full bg-slate-900 p-1 px-2 text-xs text-white hover:bg-slate-700"
        onClick={toggleDropdown}
        aria-haspopup="true"
        aria-expanded={showLanguageDropdown}>
        {langaugeToBeDisplayed ? langaugeToBeDisplayed.alias : ""}
        <LanguageIcon className="ml-1 h-3 w-3" />
      </button>
      {showLanguageDropdown && (
        <div className="absolute right-0 mt-1 space-y-2 rounded-lg bg-slate-900 p-2 text-xs text-white hover:bg-slate-700">
          {surveyLanguages.map(
            (language) =>
              language.id !== selectedLanguage && (
                <button
                  key={language.id}
                  type="button"
                  className="m-0 block w-full text-left"
                  onClick={() => changeLanguage(language)}>
                  {language.alias}
                </button>
              )
          )}
        </div>
      )}
    </div>
  );
}
