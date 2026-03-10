"use client";

import { Language } from "@prisma/client";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import type { TUserLocale } from "@formbricks/types/user";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";

interface LanguageToggleProps {
  language: Language;
  isChecked: boolean;
  onToggle: () => void;
  onEdit: () => void;
  locale: TUserLocale;
}

export function LanguageToggle({ language, isChecked, onToggle, onEdit, locale }: LanguageToggleProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col space-y-4">
      <div className="flex max-w-96 items-center space-x-4">
        <Switch
          checked={isChecked}
          id={`${language.code}-toggle`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        />
        <Label className="truncate font-medium text-slate-800" htmlFor={`${language.code}-toggle`}>
          {getLanguageLabel(language.code, locale)}
        </Label>
        {isChecked ? (
          <button
            className="truncate text-xs text-slate-600 underline hover:text-slate-800"
            onClick={onEdit}
            type="button">
            {t("environments.surveys.edit.edit_translations", {
              lang: getLanguageLabel(language.code, locale),
            })}
          </button>
        ) : null}
      </div>
    </div>
  );
}
