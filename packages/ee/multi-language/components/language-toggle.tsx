import { getLanguageLabel } from "@formbricks/lib/i18n/utils";
import type { TLanguage } from "@formbricks/types/product";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";

interface LanguageToggleProps {
  language: TLanguage;
  isChecked: boolean;
  onToggle: () => void;
  onEdit: () => void;
}

export function LanguageToggle({ language, isChecked, onToggle, onEdit }: LanguageToggleProps) {
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
          {getLanguageLabel(language.code)}
        </Label>
        {isChecked ? (
          <p className="cursor-pointer text-xs text-slate-600 underline" onClick={onEdit}>
            Edit {getLanguageLabel(language.code)} translations
          </p>
        ) : null}
      </div>
    </div>
  );
}
