import { GlobeIcon } from "@/components/general/GlobeIcon";
import { useRef, useState } from "react";
import { getLanguageLabel } from "@formbricks/lib/i18n/utils";
import { useClickOutside } from "@formbricks/lib/utils/hooks/useClickOutside";
import { TSurveyLanguage } from "@formbricks/types/surveys/types";

interface LanguageSwitchProps {
  surveyLanguages: TSurveyLanguage[];
  setSelectedLanguageCode: (languageCode: string) => void;
  setFirstRender?: (firstRender: boolean) => void;
}
export const LanguageSwitch = ({
  surveyLanguages,
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

  useClickOutside(languageDropdownRef, () => setShowLanguageDropdown(false));

  return (
    <div class="z-[1001] flex w-fit items-center even:pr-1">
      <button
        title="Language switch"
        type="button"
        class="text-heading relative h-5 w-5 rounded-md hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-2"
        onClick={toggleDropdown}
        tabIndex={-1}
        aria-haspopup="true"
        aria-expanded={showLanguageDropdown}>
        <GlobeIcon className="text-heading h-5 w-5 p-0.5" />
      </button>
      {showLanguageDropdown && (
        <div
          className="bg-brand text-on-brand absolute right-8 top-10 space-y-2 rounded-md p-2 text-xs"
          ref={languageDropdownRef}>
          {surveyLanguages.map((surveyLanguage) => {
            if (!surveyLanguage.enabled) return;
            return (
              <button
                key={surveyLanguage.language.id}
                type="button"
                className="block w-full p-1.5 text-left hover:opacity-80"
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
