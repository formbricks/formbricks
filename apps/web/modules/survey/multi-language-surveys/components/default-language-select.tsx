"use client";

import { Language } from "@prisma/client";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import { DefaultTag } from "@/modules/ui/components/default-tag";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
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
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <Label>{t("environments.surveys.edit.1_choose_the_default_language_for_this_survey")}</Label>
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
                body: t(
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
            <SelectTrigger className="w-full max-w-full truncate px-4 text-xs text-slate-800">
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
