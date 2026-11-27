import { z } from "zod";
import { getLanguageLabel } from "@formbricks/i18n-utils/utils";

// The English name is what goes into the prompt, in whatever UI locale the editor runs in.
const PROMPT_LANGUAGE_LOCALE = "en-US";

export const AI_TRANSLATION_UNKNOWN_LANGUAGE = "ai_translation_unknown_language";

/**
 * A survey language code the catalog knows (`de`, `pt-BR`, `zh-Hans`). Free text never reaches the
 * prompt: the model is told the catalog's name for the code, so a caller cannot put instructions in
 * a language field.
 */
export const ZAITranslationLanguageCode = z
  .string()
  .max(35)
  .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/)
  .refine((code) => getLanguageLabel(code, PROMPT_LANGUAGE_LOCALE) !== undefined, {
    message: AI_TRANSLATION_UNKNOWN_LANGUAGE,
  });

export const getAITranslationLanguageName = (code: string): string =>
  getLanguageLabel(code, PROMPT_LANGUAGE_LOCALE) ?? code;
