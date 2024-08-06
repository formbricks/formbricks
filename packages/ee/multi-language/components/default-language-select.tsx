import { getLanguageLabel } from "@formbricks/lib/i18n/utils";
import type { TLanguage, TProduct } from "@formbricks/types/product";
import { DefaultTag } from "@formbricks/ui/DefaultTag";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui/Select";
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
  return (
    <div className="space-y-4">
      <p className="text-sm">1. Choose the default language for this survey:</p>
      <div className="flex items-center space-x-4">
        <div className="w-48">
          <Select
            defaultValue={`${defaultLanguage?.code}`}
            disabled={Boolean(defaultLanguage)}
            onValueChange={(languageCode) => {
              setConfirmationModalInfo({
                open: true,
                title: `Set ${getLanguageLabel(languageCode)} as default language`,
                text: `Once set, the default language for this survey can only be changed by disabling the multi-language option and deleting all translations.`,
                buttonText: `Set ${getLanguageLabel(languageCode)} as default language`,
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
