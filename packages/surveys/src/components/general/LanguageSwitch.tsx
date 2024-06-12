import { GlobeIcon } from "@/components/general/GlobeIcon";
import { useRef, useState } from "react";
import { getLanguageLabel } from "@formbricks/lib/i18n/utils";
import { useClickOutside } from "@formbricks/lib/utils/hooks/useClickOutside";
import { TSurveyLanguage } from "@formbricks/types/surveys";

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
    <div className="relative z-[1100] flex w-full cursor-pointer justify-end">
      <button
        title="Language switch"
        type="button"
        className="flex items-center justify-center rounded-md text-xs hover:opacity-90"
        onClick={toggleDropdown}
        tabIndex={-1}
        aria-haspopup="true"
        aria-expanded={showLanguageDropdown}>
        <GlobeIcon className="text-heading h-6 w-6" />
      </button>
      {showLanguageDropdown && (
        <div
          className="bg-brand text-on-brand  absolute right-0 top-8 space-y-2 rounded-md p-2 text-xs "
          ref={languageDropdownRef}>
          {surveyLanguages.map((surveyLanguage) => {
            if (!surveyLanguage.enabled) return;
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
