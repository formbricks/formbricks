import { useTranslations } from "next-intl";
import { getLanguageLabel } from "@formbricks/lib/i18n/utils";
import type { TLanguage, TProduct } from "@formbricks/types/product";
import { DefaultTag } from "@formbricks/ui/components/DefaultTag";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formbricks/ui/components/Select";
import type { ConfirmationModalProps } from "./multi-language-card";

interface DefaultLanguageSelectProps {
  defaultLanguage?: TLanguage;
  handleDefaultLanguageChange: (languageCode: string) => void;
  product: TProduct;
  setConfirmationModalInfo: (confirmationModal: ConfirmationModalProps) => void;
}

export function DefaultLanguageSelect({
  defaultLanguage,
  handleDefaultLanguageChange,
  product,
  setConfirmationModalInfo,
}: DefaultLanguageSelectProps) {
  const t = useTranslations();
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
                title: t(`environments.surveys.edit.set_language_as_default_language`, {
                  language: getLanguageLabel(languageCode),
                }),
                text: t(
                  "environments.surveys.edit.once_set_the_default_language_for_this_survey_can_only_be_changed_by_disabling_the_multi_language_option_and_deleting_all_translations"
                ),
                buttonText: t("environments.surveys.edit.set_language_as_default_language", {
                  language: getLanguageLabel(languageCode),
                }),
                onConfirm: () => {
                  handleDefaultLanguageChange(languageCode);
                },
                buttonVariant: "primary",
              });
            }}
            value={`${defaultLanguage?.code}`}>
            <SelectTrigger className="xs:w-[180px] xs:text-base w-full px-4 text-xs text-slate-800 dark:border-slate-400 dark:bg-slate-700 dark:text-slate-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {product.languages.map((language) => (
                <SelectItem
                  className="xs:text-base px-0.5 py-1 text-xs text-slate-800 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-700"
                  key={language.id}
                  value={language.code}>
                  {`${getLanguageLabel(language.code)} (${language.code})`}
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
