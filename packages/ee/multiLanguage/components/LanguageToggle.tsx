import { TLanguage } from "@formbricks/types/product";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";

import { getLanguageLabel } from "../lib/isoLanguages";

interface LanguageToggleProps {
  language: TLanguage;
  isChecked: boolean;
  onToggle: () => void;
  onEdit: () => void;
}

export const LanguageToggle = ({ language, isChecked, onToggle, onEdit }: LanguageToggleProps) => {
  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center space-x-4">
        <Switch
          id={`${language.code}-toggle`}
          checked={isChecked}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        />
        <Label htmlFor={`${language.code}-toggle`} className="font-medium text-slate-800">
          {getLanguageLabel(language.code)}
        </Label>
        {isChecked && (
          <p className="cursor-pointer text-xs text-slate-600 underline" onClick={onEdit}>
            Edit {getLanguageLabel(language.code)} translations
          </p>
        )}
      </div>
    </div>
  );
};
