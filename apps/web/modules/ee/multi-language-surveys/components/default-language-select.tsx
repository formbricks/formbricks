"use client";

import { DefaultTag } from "@/modules/ui/components/default-tag";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Language } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { getLanguageLabel } from "@formbricks/lib/i18n/utils";
import type { ConfirmationModalProps } from "./multi-language-card";

interface DefaultLanguageSelectProps {
  defaultLanguage?: Language;
  handleDefaultLanguageChange: (languageCode: string) => void;
  projectLanguages: Language[];
  setConfirmationModalInfo: (confirmationModal: ConfirmationModalProps) => void;
  locale: string;
}

export function DefaultLanguageSelect({
  defaultLanguage,
  handleDefaultLanguageChange,
  projectLanguages,
  setConfirmationModalInfo,
  locale,
}: DefaultLanguageSelectProps) {
  const { t } = useTranslate();
  return (
    <div className="space-y-4">
      <p className="text-sm">
        {t("environments.surveys.edit.1_choose_the_default_language_for_this_survey")}:
      </p>
      <div className="flex items-center space-x-4">
        <div className="w-48">
          <Select
            defaultValue={`${defaultLanguage?.code}`}
            disabled={Boolean(defaultLanguage)}
            onValueChange={(languageCode) => {
              setConfirmationModalInfo({
                open: true,
                title:
                  t("environments.surveys.edit.confirm_default_language") +
                  ": " +
                  getLanguageLabel(languageCode, locale),
                text: t(
                  "environments.surveys.edit.once_set_the_default_language_for_this_survey_can_only_be_changed_by_disabling_the_multi_language_option_and_deleting_all_translations"
                ),
                buttonText: t("common.confirm"),
                onConfirm: () => {
                  handleDefaultLanguageChange(languageCode);
                },
                buttonVariant: "default",
              });
            }}
            value={`${defaultLanguage?.code}`}>
            <SelectTrigger className="xs:w-[180px] xs:text-base w-full px-4 text-xs text-slate-800 dark:border-slate-400 dark:bg-slate-700 dark:text-slate-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projectLanguages.map((language) => (
                <SelectItem
                  className="xs:text-base px-0.5 py-1 text-xs text-slate-800 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-700"
                  key={language.id}
                  value={language.code}>
                  {`${getLanguageLabel(language.code, locale)} (${language.code})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DefaultTag />
      </div>
    </div>
  );
}
