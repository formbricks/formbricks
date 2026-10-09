import { normalizeLanguageCode } from "@formbricks/i18n-utils/canonical";
import { normalizeV3SurveyWriteLanguageCode } from "@/app/api/v3/surveys/language";

/**
 * Qualtrics language codes → the region-qualified BCP-47 tags the v3 survey document stores.
 *
 * Qualtrics writes its own upper-case codes (`EN`, `DE`, `ZH-S`). Most resolve through
 * `normalizeLanguageCode`; this table covers the ones that do not (`ZH-S` is `null` there) and the ones
 * where Qualtrics' region differs from the one we would infer. v3 refuses a bare `en`, so every value
 * here is region-qualified.
 *
 * Spanish follows Qualtrics' Translate Survey list: `ES` is "Spanish LATAM" and `ES-ES` is "Spanish EU",
 * so a survey can carry both and neither may take the other's code.
 *
 * A `Map`, not an object literal: a lookup by a code from the file must never find an inherited
 * member.
 */
const QUALTRICS_LANGUAGE_OVERRIDES: ReadonlyMap<string, string> = new Map([
  ["EN", "en-US"],
  ["EN-GB", "en-GB"],
  ["DE", "de-DE"],
  ["FR", "fr-FR"],
  ["FR-CA", "fr-CA"],
  ["ES", "es-419"],
  ["ES-ES", "es-ES"],
  ["ES-419", "es-419"],
  ["PT", "pt-PT"],
  ["PT-BR", "pt-BR"],
  ["ZH-S", "zh-Hans-CN"],
  ["ZH-T", "zh-Hant-TW"],
  ["NO", "nb-NO"],
]);

/**
 * A language code as Qualtrics or BCP-47 writes one: a 2–3 letter language, then up to three subtags.
 * Checked before any lookup, so `__proto__`, `constructor` or a 10 kB string never reaches the table
 * or `normalizeLanguageCode` (whose own table is a plain object).
 */
const QUALTRICS_LANGUAGE_CODE_PATTERN = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{1,8}){0,3}$/;
/** Longer than any code the pattern admits (30) with room for spaces: refused before it is trimmed. */
const MAX_RAW_LANGUAGE_CODE_CHARS = 64;

/**
 * One Qualtrics code however the file spells it: ` de`, `DE` and `de` are the same code, `ZH_S` and
 * `ZH-S` too. Two raw codes with the same spelling here are one code; two with different spellings that
 * normalize to one language are two codes the survey cannot both keep.
 */
export const qualtricsLanguageCodeSpelling = (raw: string): string =>
  raw.trim().toUpperCase().replaceAll("_", "-");

/** The normalized code, or `null` when Formbricks has no equivalent for it. */
export function normalizeQualtricsLanguageCode(raw: string): string | null {
  if (raw.length > MAX_RAW_LANGUAGE_CODE_CHARS) return null;
  const trimmed = raw.trim();
  if (!QUALTRICS_LANGUAGE_CODE_PATTERN.test(trimmed)) return null;

  const canonical =
    QUALTRICS_LANGUAGE_OVERRIDES.get(qualtricsLanguageCodeSpelling(trimmed)) ??
    normalizeLanguageCode(trimmed);
  if (!canonical) return null;

  // What v3 stores on create: region-qualified and canonical. `null` for a bare or script-only tag.
  return normalizeV3SurveyWriteLanguageCode(canonical);
}

/** Whether a raw code is worth naming in a report line: bounded, so a report never quotes a blob. */
export function isReportableLanguageCode(raw: string): boolean {
  return raw.length <= MAX_RAW_LANGUAGE_CODE_CHARS && QUALTRICS_LANGUAGE_CODE_PATTERN.test(raw.trim());
}
