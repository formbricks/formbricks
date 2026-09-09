import { normalizeLanguageCode } from "@formbricks/i18n-utils/canonical";
import { normalizeV3SurveyLanguageTag } from "@/app/api/v3/surveys/language";
import { DEFAULT_V3_SURVEY_LANGUAGE } from "@/app/api/v3/surveys/schemas";
import { importError, importInfo } from "../report";
import type { TImportIssue } from "../types";
import { isI18nMap, isRecord } from "./paths";

export type TLanguageResolutionResult = {
  document: Record<string, unknown>;
  issues: TImportIssue[];
  /** Every language code the document uses after normalization, default first. */
  codes: string[];
};

/** A code as the file wrote it → the canonical BCP-47 tag v3 stores, or null when nothing recognizes it. */
export function canonicalizeImportLanguageCode(code: string): string | null {
  return normalizeV3SurveyLanguageTag(code) ?? normalizeLanguageCode(code) ?? null;
}

/** Rewrite one locale key everywhere a translatable map uses it. */
function rewriteLanguageKey(value: unknown, from: string, to: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => rewriteLanguageKey(entry, from, to));
    return;
  }
  if (!isRecord(value)) return;

  if (isI18nMap(value)) {
    if (Object.hasOwn(value, from) && from !== to) {
      value[to] = value[from];
      delete value[from];
    }
    return;
  }

  Object.values(value).forEach((entry) => rewriteLanguageKey(entry, from, to));
}

/**
 * Normalize every language code the document declares and say which ones the workspace does not
 * have yet. Creation itself happens in the v3 create route (`ensureV3WorkspaceLanguages`).
 */
export function resolveImportLanguages(
  input: Record<string, unknown>,
  workspaceLanguageCodes: readonly string[]
): TLanguageResolutionResult {
  const document = input;
  const issues: TImportIssue[] = [];
  const knownCodes = new Set(workspaceLanguageCodes.map((code) => code.toLowerCase()));
  const canonicalByRaw = new Map<string, string>();

  const canonicalize = (raw: string, path: string): string | null => {
    const canonical = canonicalizeImportLanguageCode(raw);
    if (!canonical) {
      issues.push(importError({ code: "language_unknown", path, vars: { code: raw } }));
      return null;
    }
    if (canonical !== raw) {
      canonicalByRaw.set(raw, canonical);
    }
    return canonical;
  };

  const rawDefault = typeof document.defaultLanguage === "string" ? document.defaultLanguage : undefined;
  const defaultCode = rawDefault ? canonicalize(rawDefault, "defaultLanguage") : DEFAULT_V3_SURVEY_LANGUAGE;
  if (defaultCode) {
    document.defaultLanguage = defaultCode;
  }

  const codes: string[] = defaultCode ? [defaultCode] : [];
  if (Array.isArray(document.languages)) {
    document.languages.forEach((language, index) => {
      if (!isRecord(language) || typeof language.code !== "string") return;
      const canonical = canonicalize(language.code, `languages.${index}.code`);
      if (!canonical) return;
      language.code = canonical;
      if (!codes.includes(canonical)) codes.push(canonical);
    });
  }

  for (const [raw, canonical] of canonicalByRaw) {
    rewriteLanguageKey(document, raw, canonical);
  }

  for (const code of codes) {
    if (!knownCodes.has(code.toLowerCase())) {
      issues.push(importInfo({ code: "language_created", vars: { code } }));
    }
  }

  return { document, issues, codes };
}
