import { TI18nString } from "@formbricks/types/i18n";

export interface TranslatableString {
  path: string;
  displayId: string;
  fieldLabel: string;
  value: TI18nString;
  isRichText: boolean;
  elementId: string;
}

export interface TranslationProgress {
  translated: number;
  total: number;
  percentage: number;
}
