import { normalizeLanguageCode } from "@formbricks/i18n-utils/canonical";
import { normalizeV3SurveyWriteLanguageCode } from "@/app/api/v3/surveys/language";
import { SURVEY_IMPORT_MAX_LANGUAGE_CODE_CHARS } from "../limits";

/**
 * A language code from an imported file or an AI plan → the region-qualified BCP-47 tag the v3 survey
 * document stores, for every lane. A lane whose files write their own codes (Qualtrics' `ZH-S`) looks
 * those up first.
 */

/**
 * A language code as a file or BCP-47 writes one: a 2–3 letter language, then up to three subtags.
 * Checked before any lookup, so `__proto__`, `constructor` or a 10 kB string never reaches a table or
 * `normalizeLanguageCode` (whose own table is a plain object).
 */
export const IMPORT_LANGUAGE_CODE_PATTERN = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{1,8}){0,3}$/;

/** Whether a raw code can be a language code at all: bounded, and shaped like one. */
export const isLanguageCodeShaped = (raw: string): boolean =>
  raw.length <= SURVEY_IMPORT_MAX_LANGUAGE_CODE_CHARS && IMPORT_LANGUAGE_CODE_PATTERN.test(raw.trim());

/**
 * The normalized code, or `null` when Formbricks has no equivalent for it. `override` maps a lane's own
 * spelling of a code to a canonical tag before the generic lookup.
 */
export function normalizeImportLanguageCode(
  raw: string,
  override?: (trimmed: string) => string | undefined
): string | null {
  if (!isLanguageCodeShaped(raw)) return null;
  const trimmed = raw.trim();
  const canonical = override?.(trimmed) ?? normalizeLanguageCode(trimmed);
  if (!canonical) return null;

  // What v3 stores on create: region-qualified and canonical. `null` for a bare or script-only tag.
  return normalizeV3SurveyWriteLanguageCode(canonical);
}
