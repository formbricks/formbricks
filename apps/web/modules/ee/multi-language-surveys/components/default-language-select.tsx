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
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
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
      <div className="flex items-center space-x-2">
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
            <SelectTrigger className="w-[180px] px-4 text-sm text-slate-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projectLanguages.map((language) => (
                <SelectItem
                  className="px-0.5 py-1 text-sm text-slate-800"
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
