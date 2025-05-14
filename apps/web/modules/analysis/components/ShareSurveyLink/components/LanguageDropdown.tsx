import { getEnabledLanguages } from "@/lib/i18n/utils";
import { useClickOutside } from "@/lib/utils/hooks/useClickOutside";
import { Button } from "@/modules/ui/components/button";
import { Languages } from "lucide-react";
import { useRef, useState } from "react";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface LanguageDropdownProps {
  survey: TSurvey;
  setLanguage: (language: string) => void;
  locale: TUserLocale;
}

export const LanguageDropdown = ({ survey, setLanguage, locale }: LanguageDropdownProps) => {
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);
  const languageDropdownRef = useRef(null);
  const enabledLanguages = getEnabledLanguages(survey.languages ?? []);

  useClickOutside(languageDropdownRef, () => setShowLanguageSelect(false));

  return (
    enabledLanguages.length > 1 && (
      <div className="relative">
        {showLanguageSelect && (
          <div
            className="absolute top-12 z-30 w-fit rounded-lg border bg-slate-900 p-1 text-sm text-white"
            ref={languageDropdownRef}>
            {enabledLanguages.map((surveyLanguage) => (
              <button
                key={surveyLanguage.language.code}
                className="rounded-md p-2 hover:cursor-pointer hover:bg-slate-700"
                onClick={() => {
                  setLanguage(surveyLanguage.language.code);
                  setShowLanguageSelect(false);
                }}>
                {getLanguageLabel(surveyLanguage.language.code, locale)}
              </button>
            ))}
          </div>
        )}
        <Button
          variant="secondary"
          title="Select Language"
          aria-label="Select Language"
          onClick={() => setShowLanguageSelect(!showLanguageSelect)}>
          <Languages className="h-5 w-5" />
        </Button>
      </div>
    )
  );
};
