import type { InvalidParam } from "@/app/api/v3/lib/response";
import { validateV3SurveyReferences } from "./reference-validation";
import type { TV3SurveyDocument } from "./schemas";
import { V3_SURVEY_TRANSLATABLE_METADATA_KEYS } from "./translation-fields";

export type TV3SurveyDocumentValidationResult =
  | { valid: true; invalidParams: [] }
  | { valid: false; invalidParams: InvalidParam[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInternalI18nString(value: unknown): value is Record<string, string> {
  return (
    isPlainObject(value) &&
    typeof value.default === "string" &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

function getConfiguredTranslationLanguageCodes(document: TV3SurveyDocument): string[] {
  const defaultLanguage = document.defaultLanguage.toLowerCase();
  const languageCodes = new Set<string>();

  document.languages.forEach((language) => {
    const code = language.code;
    if (code.toLowerCase() !== defaultLanguage) {
      languageCodes.add(code);
    }
  });

  return Array.from(languageCodes.values());
}

function getConfiguredLanguageCodeLookup(document: TV3SurveyDocument): Set<string> {
  const languageCodes = new Set<string>([document.defaultLanguage.toLowerCase()]);

  document.languages.forEach((language) => {
    languageCodes.add(language.code.toLowerCase());
  });

  return languageCodes;
}

function addTranslationLanguageIssues(
  value: unknown,
  path: string,
  configuredLanguageCodes: Set<string>,
  requiredLanguageCodes: string[],
  issues: InvalidParam[]
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      addTranslationLanguageIssues(
        entry,
        path ? `${path}.${index}` : String(index),
        configuredLanguageCodes,
        requiredLanguageCodes,
        issues
      )
    );
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  if (isInternalI18nString(value)) {
    Object.keys(value).forEach((languageCode) => {
      if (languageCode !== "default" && !configuredLanguageCodes.has(languageCode.toLowerCase())) {
        issues.push({
          name: path,
          reason: `Language '${languageCode}' is not declared in languages`,
          code: "unsupported_locale",
          identifier: languageCode,
          referenceType: "language",
        });
      }
    });

    requiredLanguageCodes.forEach((languageCode) => {
      if (value[languageCode] === undefined) {
        issues.push({
          name: path,
          reason: `Translatable field is missing configured language '${languageCode}'`,
          code: "missing_translation",
          identifier: languageCode,
          referenceType: "language",
          missingId: languageCode,
        });
      }
    });
    return;
  }

  Object.entries(value).forEach(([key, entry]) =>
    addTranslationLanguageIssues(
      entry,
      path ? `${path}.${key}` : key,
      configuredLanguageCodes,
      requiredLanguageCodes,
      issues
    )
  );
}

function addMetadataTranslationLanguageIssues(
  metadata: TV3SurveyDocument["metadata"],
  configuredLanguageCodes: Set<string>,
  requiredLanguageCodes: string[],
  issues: InvalidParam[]
): void {
  if (!isPlainObject(metadata)) {
    return;
  }

  V3_SURVEY_TRANSLATABLE_METADATA_KEYS.forEach((key) =>
    addTranslationLanguageIssues(
      metadata[key],
      `metadata.${key}`,
      configuredLanguageCodes,
      requiredLanguageCodes,
      issues
    )
  );
}

function getV3SurveyLanguageInvalidParams(document: TV3SurveyDocument): InvalidParam[] {
  const configuredLanguageCodes = getConfiguredLanguageCodeLookup(document);
  const languageCodes = getConfiguredTranslationLanguageCodes(document);
  const issues: InvalidParam[] = [];

  addTranslationLanguageIssues(
    document.welcomeCard,
    "welcomeCard",
    configuredLanguageCodes,
    languageCodes,
    issues
  );
  addTranslationLanguageIssues(document.blocks, "blocks", configuredLanguageCodes, languageCodes, issues);
  addTranslationLanguageIssues(document.endings, "endings", configuredLanguageCodes, languageCodes, issues);
  addMetadataTranslationLanguageIssues(document.metadata, configuredLanguageCodes, languageCodes, issues);

  return issues;
}

export function validateV3SurveyDocument(document: TV3SurveyDocument): TV3SurveyDocumentValidationResult {
  const languageInvalidParams = getV3SurveyLanguageInvalidParams(document);
  const invalidParams = [...languageInvalidParams];

  const referenceValidation = validateV3SurveyReferences({
    blocks: document.blocks,
    endings: document.endings,
    hiddenFields: document.hiddenFields,
    metadata: document.metadata,
    variables: document.variables,
    welcomeCard: document.welcomeCard,
  });

  if (!referenceValidation.ok) {
    invalidParams.push(...referenceValidation.invalidParams);
  }

  if (invalidParams.length > 0) {
    return {
      valid: false,
      invalidParams,
    };
  }

  return { valid: true, invalidParams: [] };
}
