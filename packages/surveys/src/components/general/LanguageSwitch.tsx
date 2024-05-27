import { useRef, useState } from "react";

import { getLanguageLabel } from "@formbricks/lib/i18n/utils";
import { useClickOutside } from "@formbricks/lib/utils/hooks/useClickOutside";
import { TSurveyLanguage } from "@formbricks/types/surveys";

interface LanguageSwitchProps {
  selectedLanguageCode: string;
  surveyLanguages: TSurveyLanguage[];
  setSelectedLanguageCode: (languageCode: string) => void;
  setFirstRender?: (firstRender: boolean) => void;
}
export const LanguageSwitch = ({
  surveyLanguages,
  selectedLanguageCode,
  setSelectedLanguageCode,
  setFirstRender,
}: LanguageSwitchProps) => {
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const toggleDropdown = () => setShowLanguageDropdown((prev) => !prev);
  const languageDropdownRef = useRef(null);
  const defaultLanguageCode = surveyLanguages.find((surveyLanguage) => {
    return surveyLanguage.default === true;
  })?.language.code;

  const changeLanguage = (languageCode: string) => {
    if (languageCode === defaultLanguageCode) {
      setSelectedLanguageCode("default");
    } else {
      setSelectedLanguageCode(languageCode);
    }
    if (setFirstRender) {
      //for lexical editor
      setFirstRender(true);
    }
    setShowLanguageDropdown(false);
  };

  const languageToBeDisplayed = surveyLanguages.find((language) => {
    return selectedLanguageCode === "default"
      ? language.default === true
      : language.language.code === selectedLanguageCode;
  });

  useClickOutside(languageDropdownRef, () => setShowLanguageDropdown(false));

  const shouldRenderLanguage = (language: TSurveyLanguage) => {
    if (language.language.code === defaultLanguageCode && selectedLanguageCode === "default") return false;
    else if (language.language.code !== selectedLanguageCode && language.enabled) return true;
    return false;
  };

  return (
    <div className="relative z-[1100] ml-2 mt-2 w-fit cursor-pointer">
      <button
        type="button"
        className="bg-brand text-on-brand flex items-center justify-center rounded-md p-2 px-2 text-xs hover:opacity-90"
        onClick={toggleDropdown}
        tabIndex={-1}
        aria-haspopup="true"
        aria-expanded={showLanguageDropdown}>
        {languageToBeDisplayed ? getLanguageLabel(languageToBeDisplayed?.language.code) : ""}
      </button>
      {showLanguageDropdown && (
        <div
          className="bg-brand text-on-brand  absolute left-0 mt-1 space-y-2 rounded-md p-2 text-xs "
          ref={languageDropdownRef}>
          {surveyLanguages.map((surveyLanguage) => {
            if (!shouldRenderLanguage(surveyLanguage)) return;
            return (
              <button
                key={surveyLanguage.language.id}
                type="button"
                className="block w-full rounded-sm p-1 text-left hover:opacity-90"
                onClick={() => changeLanguage(surveyLanguage.language.code)}>
                {getLanguageLabel(surveyLanguage.language.code)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
