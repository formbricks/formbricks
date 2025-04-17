import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { getLanguageLabel } from "@formbricks/lib/i18n/utils";
import { useClickOutside } from "@formbricks/lib/utils/hooks/useClickOutside";
import type { TSurveyLanguage } from "@formbricks/types/surveys/types";

interface LanguageIndicatorProps {
  selectedLanguageCode: string;
  surveyLanguages: TSurveyLanguage[];
  setSelectedLanguageCode: (languageCode: string) => void;
  setFirstRender?: (firstRender: boolean) => void;
  locale: string;
}
export function LanguageIndicator({
  surveyLanguages,
  selectedLanguageCode,
  setSelectedLanguageCode,
  setFirstRender,
  locale,
}: LanguageIndicatorProps) {
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const toggleDropdown = () => {
    setShowLanguageDropdown((prev) => !prev);
  };
  const languageDropdownRef = useRef(null);

  const changeLanguage = (language: TSurveyLanguage) => {
    setSelectedLanguageCode(language.default ? "default" : language.language.code);
    if (setFirstRender) {
      //for lexical editor
      setFirstRender(true);
    }
    setShowLanguageDropdown(false);
  };

  const languageToBeDisplayed = surveyLanguages.find((language) => {
    return selectedLanguageCode === "default"
      ? language.default
      : language.language.code === selectedLanguageCode;
  });

  useClickOutside(languageDropdownRef, () => {
    setShowLanguageDropdown(false);
  });

  return (
    <div className="absolute top-2 right-2">
      <button
        aria-expanded={showLanguageDropdown}
        aria-haspopup="true"
        className="relative z-20 flex items-center justify-center rounded-md bg-slate-900 p-1 px-2 text-xs text-white hover:bg-slate-700"
        onClick={toggleDropdown}
        tabIndex={-1}
        type="button">
        {languageToBeDisplayed ? getLanguageLabel(languageToBeDisplayed.language.code, locale) : ""}
        <ChevronDown className="ml-1 h-4 w-4" />
      </button>
      {showLanguageDropdown ? (
        <div
          className="absolute right-0 z-30 mt-1 space-y-2 rounded-md bg-slate-900 p-1 text-xs text-white"
          ref={languageDropdownRef}>
          {surveyLanguages.map(
            (language) =>
              language.language.code !== languageToBeDisplayed?.language.code &&
              language.enabled && (
                <button
                  className="block w-full rounded-xs p-1 text-left hover:bg-slate-700"
                  key={language.language.id}
                  onClick={() => {
                    changeLanguage(language);
                  }}
                  type="button">
                  {getLanguageLabel(language.language.code, locale)}
                </button>
              )
          )}
        </div>
      ) : null}
    </div>
  );
}
