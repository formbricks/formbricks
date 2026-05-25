import type { InvalidParam } from "@/app/api/v3/lib/response";
import { validateV3SurveyReferences } from "./reference-validation";
import type { TV3SurveyDocument } from "./schemas";

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

function collectTranslationLanguageCodes(value: unknown, languageCodes: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectTranslationLanguageCodes(entry, languageCodes));
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  if (isInternalI18nString(value)) {
    Object.keys(value).forEach((languageCode) => {
      if (languageCode !== "default") {
        languageCodes.add(languageCode);
      }
    });
    return;
  }

  Object.values(value).forEach((entry) => collectTranslationLanguageCodes(entry, languageCodes));
}

function getRequiredTranslationLanguageCodes(document: TV3SurveyDocument): string[] {
  const languageCodes = new Set(getConfiguredTranslationLanguageCodes(document));

  collectTranslationLanguageCodes(document.welcomeCard, languageCodes);
  collectTranslationLanguageCodes(document.blocks, languageCodes);
  collectTranslationLanguageCodes(document.endings, languageCodes);

  return Array.from(languageCodes.values());
}

function addMissingTranslationIssues(
  value: unknown,
  path: string,
  languageCodes: string[],
  issues: InvalidParam[]
): void {
  if (languageCodes.length === 0) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      addMissingTranslationIssues(entry, path ? `${path}.${index}` : String(index), languageCodes, issues)
    );
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  if (isInternalI18nString(value)) {
    languageCodes.forEach((languageCode) => {
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
    addMissingTranslationIssues(entry, path ? `${path}.${key}` : key, languageCodes, issues)
  );
}

function getV3SurveyLanguageInvalidParams(document: TV3SurveyDocument): InvalidParam[] {
  const languageCodes = getRequiredTranslationLanguageCodes(document);
  const issues: InvalidParam[] = [];

  addMissingTranslationIssues(document.welcomeCard, "welcomeCard", languageCodes, issues);
  addMissingTranslationIssues(document.blocks, "blocks", languageCodes, issues);
  addMissingTranslationIssues(document.endings, "endings", languageCodes, issues);

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
