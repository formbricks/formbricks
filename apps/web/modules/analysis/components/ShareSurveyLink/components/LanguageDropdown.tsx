import { Button } from "@/modules/ui/components/button";
import { Languages } from "lucide-react";
import { useRef, useState } from "react";
import { getEnabledLanguages } from "@formbricks/lib/i18n/utils";
import { getLanguageLabel } from "@formbricks/lib/i18n/utils";
import { useClickOutside } from "@formbricks/lib/utils/hooks/useClickOutside";
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
              <div
                key={surveyLanguage.language.code}
                className="rounded-md p-2 hover:cursor-pointer hover:bg-slate-700"
                onClick={() => {
                  setLanguage(surveyLanguage.language.code);
                  setShowLanguageSelect(false);
                }}>
                {getLanguageLabel(surveyLanguage.language.code, locale)}
              </div>
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
