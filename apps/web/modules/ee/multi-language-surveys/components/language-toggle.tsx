"use client";

import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";
import { Language } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { getLanguageLabel } from "@formbricks/lib/i18n/utils";
import type { TUserLocale } from "@formbricks/types/user";

interface LanguageToggleProps {
  language: Language;
  isChecked: boolean;
  onToggle: () => void;
  onEdit: () => void;
  locale: TUserLocale;
}

export function LanguageToggle({ language, isChecked, onToggle, onEdit, locale }: LanguageToggleProps) {
  const { t } = useTranslate();
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
              lang: getLanguageLabel(language.code, locale),
            })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
