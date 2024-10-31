import { useTranslations } from "next-intl";
import { getLanguageLabel } from "@formbricks/lib/i18n/utils";
import type { TLanguage } from "@formbricks/types/product";
import type { TUserLocale } from "@formbricks/types/user";
import { Label } from "@formbricks/ui/components/Label";
import { Switch } from "@formbricks/ui/components/Switch";

interface LanguageToggleProps {
  language: TLanguage;
  isChecked: boolean;
  onToggle: () => void;
  onEdit: () => void;
  locale: TUserLocale;
}

export function LanguageToggle({ language, isChecked, onToggle, onEdit, locale }: LanguageToggleProps) {
  const t = useTranslations();
  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center space-x-4">
        <Switch
          checked={isChecked}
          id={`${language.code}-toggle`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        />
        <Label className="font-medium text-slate-800" htmlFor={`${language.code}-toggle`}>
          {getLanguageLabel(language.code, locale)}
        </Label>
        {isChecked ? (
          <p className="cursor-pointer text-xs text-slate-600 underline" onClick={onEdit}>
            {t("environments.surveys.edit.edit_translations", {
              language: getLanguageLabel(language.code, locale),
            })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
