import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import type { TSurveyLanguage } from "@formbricks/types/surveys/types";
import { useClickOutside } from "@/lib/utils/hooks/useClickOutside";

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
    <div className="absolute right-2 top-2">
      <button
        aria-expanded={showLanguageDropdown}
        aria-haspopup="true"
        className="relative z-20 flex max-w-[120px] items-center justify-center rounded-md bg-slate-900 p-1 px-2 text-xs text-white hover:bg-slate-700"
        onClick={toggleDropdown}
        tabIndex={-1}
        type="button">
        <span className="max-w-full truncate">
          {languageToBeDisplayed ? getLanguageLabel(languageToBeDisplayed.language.code, locale) : ""}
        </span>
        <ChevronDown className="ml-1 h-4 w-4 flex-shrink-0" />
      </button>
      {showLanguageDropdown ? (
        <div
          className="absolute right-0 z-30 mt-1 max-h-64 w-48 space-y-2 overflow-auto rounded-md bg-slate-900 p-1 text-xs text-white"
          ref={languageDropdownRef}>
          {surveyLanguages.map(
            (language) =>
              language.language.code !== languageToBeDisplayed?.language.code &&
              language.enabled && (
                <button
                  className="flex w-full rounded-sm p-1 text-left hover:bg-slate-700"
                  key={language.language.id}
                  onClick={() => {
                    changeLanguage(language);
                  }}
                  type="button">
                  <span className="min-w-0 flex-1 truncate">
                    {getLanguageLabel(language.language.code, locale)}
                  </span>
                </button>
              )
          )}
        </div>
      ) : null}
    </div>
  );
}
