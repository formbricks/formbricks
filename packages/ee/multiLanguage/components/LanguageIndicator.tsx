import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";

import { useClickOutside } from "@formbricks/lib/utils/hooks/useClickOutside";
import { TSurveyLanguage } from "@formbricks/types/surveys";

import { getLanguageLabel } from "../lib/isoLanguages";

interface LanguageIndicatorProps {
  selectedLanguageCode: string;
  surveyLanguages: TSurveyLanguage[];
  setSelectedLanguageCode: (languageCode: string) => void;
  setFirstRender?: (firstRender: boolean) => void;
}
export function LanguageIndicator({
  surveyLanguages,
  selectedLanguageCode,
  setSelectedLanguageCode,
  setFirstRender,
}: LanguageIndicatorProps) {
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const toggleDropdown = () => setShowLanguageDropdown((prev) => !prev);
  const languageDropdownRef = useRef(null);

  const changeLanguage = (language: TSurveyLanguage) => {
    setSelectedLanguageCode(language.language.code);
    if (setFirstRender) {
      //for lexical editor
      setFirstRender(true);
    }
    setShowLanguageDropdown(false);
  };

  const langaugeToBeDisplayed = surveyLanguages.find((language) => {
    return selectedLanguageCode === "default"
      ? language.default === true
      : language.language.code === selectedLanguageCode;
  });

  useClickOutside(languageDropdownRef, () => setShowLanguageDropdown(false));

  return (
    <div className="absolute right-2 top-2">
      <button
        type="button"
        className="flex items-center justify-center rounded-md bg-slate-900 p-1 px-2 text-xs text-white hover:bg-slate-700"
        onClick={toggleDropdown}
        tabIndex={-1}
        aria-haspopup="true"
        aria-expanded={showLanguageDropdown}>
        {langaugeToBeDisplayed ? getLanguageLabel(langaugeToBeDisplayed?.language.code) : ""}
        <ChevronDown className="ml-1 h-4 w-4" />
      </button>
      {showLanguageDropdown && (
        <div
          className="absolute right-0 z-30 mt-1 space-y-2 rounded-md bg-slate-900 p-1 text-xs text-white "
          ref={languageDropdownRef}>
          {surveyLanguages.map(
            (language) =>
              language.language.code !== langaugeToBeDisplayed?.language.code && (
                <button
                  key={language.language.id}
                  type="button"
                  className="block w-full rounded-sm p-1 text-left hover:bg-slate-700"
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
