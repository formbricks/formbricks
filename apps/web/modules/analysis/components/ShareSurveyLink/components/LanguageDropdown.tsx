import { Languages } from "lucide-react";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { getEnabledLanguages } from "@/lib/i18n/utils";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface LanguageDropdownProps {
  survey: TSurvey;
  setLanguage: (language: string) => void;
  locale: TUserLocale;
}

export const LanguageDropdown = ({ survey, setLanguage, locale }: LanguageDropdownProps) => {
  const enabledLanguages = getEnabledLanguages(survey.languages ?? []);

  if (enabledLanguages.length <= 1) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" title="Select Language" aria-label="Select Language">
          <Languages className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="max-h-64 max-w-48 overflow-auto bg-slate-900 p-1 text-sm text-white"
        align="start">
        {enabledLanguages.map((surveyLanguage) => (
          <DropdownMenuItem
            key={surveyLanguage.language.code}
            className="w-full truncate rounded-md p-2 text-start text-white hover:cursor-pointer hover:bg-slate-700 focus:bg-slate-700"
            onSelect={() => setLanguage(surveyLanguage.language.code)}>
            {getLanguageLabel(surveyLanguage.language.code, locale)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
