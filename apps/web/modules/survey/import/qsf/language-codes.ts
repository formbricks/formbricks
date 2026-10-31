import { isLanguageCodeShaped, normalizeImportLanguageCode } from "../core/language-codes";

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
 * One Qualtrics code however the file spells it: ` de`, `DE` and `de` are the same code, `ZH_S` and
 * `ZH-S` too. Two raw codes with the same spelling here are one code; two with different spellings that
 * normalize to one language are two codes the survey cannot both keep.
 */
export const qualtricsLanguageCodeSpelling = (raw: string): string =>
  raw.trim().toUpperCase().replaceAll("_", "-");

/** The normalized code, or `null` when Formbricks has no equivalent for it. */
export const normalizeQualtricsLanguageCode = (raw: string): string | null =>
  normalizeImportLanguageCode(raw, (trimmed) =>
    QUALTRICS_LANGUAGE_OVERRIDES.get(qualtricsLanguageCodeSpelling(trimmed))
  );

/** Whether a raw code is worth naming in a report line: bounded, so a report never quotes a blob. */
export const isReportableLanguageCode = isLanguageCodeShaped;
