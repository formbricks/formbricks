import type { InvalidParam } from "@/app/api/v3/lib/response";
import { checkForInvalidMediaInBlocks } from "@/lib/survey/utils";
import { isInternalI18nString, isPlainObject } from "./guards";
import {
  getV3SurveyIntroducedPrecedenceInvalidParams,
  getV3SurveyPrecedenceInvalidParams,
  validateV3SurveyReferences,
} from "./reference-validation";
import type { TV3SurveyDocument } from "./schemas";
import { V3_SURVEY_TRANSLATABLE_METADATA_KEYS } from "./translation-fields";

export type TV3SurveyDocumentValidationResult =
  | { valid: true; invalidParams: [] }
  | { valid: false; invalidParams: InvalidParam[] };

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

function getDeclaredLanguageCodeSet(document: TV3SurveyDocument): Set<string> {
  return new Set([
    document.defaultLanguage.toLowerCase(),
    ...document.languages.map((language) => language.code.toLowerCase()),
  ]);
}

function addUnsupportedLocaleIssues(
  value: unknown,
  path: string,
  declaredLanguageCodes: Set<string>,
  issues: InvalidParam[]
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      addUnsupportedLocaleIssues(
        entry,
        path ? `${path}.${index}` : String(index),
        declaredLanguageCodes,
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
      if (languageCode !== "default" && !declaredLanguageCodes.has(languageCode.toLowerCase())) {
        issues.push({
          name: `${path}.${languageCode}`,
          reason: `Language '${languageCode}' must be declared in languages before it can be used in translatable content`,
          code: "unsupported_locale",
          identifier: languageCode,
          referenceType: "language",
        });
      }
    });
    return;
  }

  Object.entries(value).forEach(([key, entry]) =>
    addUnsupportedLocaleIssues(entry, path ? `${path}.${key}` : key, declaredLanguageCodes, issues)
  );
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
  const declaredLanguageCodes = getDeclaredLanguageCodeSet(document);
  const languageCodes = getConfiguredTranslationLanguageCodes(document);
  const issues: InvalidParam[] = [];

  if (isPlainObject(document.metadata)) {
    V3_SURVEY_TRANSLATABLE_METADATA_KEYS.forEach((key) =>
      addUnsupportedLocaleIssues(document.metadata[key], `metadata.${key}`, declaredLanguageCodes, issues)
    );
  }
  addUnsupportedLocaleIssues(document.welcomeCard, "welcomeCard", declaredLanguageCodes, issues);
  addUnsupportedLocaleIssues(document.blocks, "blocks", declaredLanguageCodes, issues);
  addUnsupportedLocaleIssues(document.endings, "endings", declaredLanguageCodes, issues);

  if (isPlainObject(document.metadata)) {
    V3_SURVEY_TRANSLATABLE_METADATA_KEYS.forEach((key) =>
      addMissingTranslationIssues(document.metadata[key], `metadata.${key}`, languageCodes, issues)
    );
  }
  addMissingTranslationIssues(document.welcomeCard, "welcomeCard", languageCodes, issues);
  addMissingTranslationIssues(document.blocks, "blocks", languageCodes, issues);
  addMissingTranslationIssues(document.endings, "endings", languageCodes, issues);

  return issues;
}

export function getV3SurveyMediaInvalidParams(blocks: TV3SurveyDocument["blocks"]): InvalidParam[] {
  const validation = checkForInvalidMediaInBlocks(blocks);

  if (validation.ok) {
    return [];
  }

  return [
    {
      name: "blocks",
      reason: validation.error.message,
    },
  ];
}

/**
 * How strictly to apply the ordering rules (ENG-3069).
 *
 * `enforce` on create, where there is no prior state to preserve. `introduced` on the patch family,
 * which reports only what the change adds — enforcing the full set would make a survey that already
 * contains a forward recall unpatchable, including by a patch that never touches it.
 */
export type TV3SurveyPrecedencePolicy =
  // Not reached in production today: enforcing the full set anywhere would reject input that is
  // currently valid. Kept for the rollout that tightens create behind a version bump.
  | { mode: "enforce" }
  | { mode: "introduced"; baseline: TV3SurveyDocument }
  // Building the *stored* document: never judge its ordering. We did not author it, and failing here
  // would make an existing survey with a forward recall unpatchable — precisely the ENG-3070 bug this
  // rule is supposed to avoid causing.
  | { mode: "skip" };

function toReferenceInput(document: TV3SurveyDocument) {
  return {
    blocks: document.blocks,
    endings: document.endings,
    hiddenFields: document.hiddenFields,
    metadata: document.metadata,
    variables: document.variables,
    welcomeCard: document.welcomeCard,
  };
}

export function validateV3SurveyDocument(
  document: TV3SurveyDocument,
  precedence: TV3SurveyPrecedencePolicy = { mode: "enforce" }
): TV3SurveyDocumentValidationResult {
  const languageInvalidParams = getV3SurveyLanguageInvalidParams(document);
  const mediaInvalidParams = getV3SurveyMediaInvalidParams(document.blocks);
  const invalidParams = [...languageInvalidParams, ...mediaInvalidParams];

  const referenceInput = toReferenceInput(document);
  const referenceValidation = validateV3SurveyReferences(referenceInput);

  if (!referenceValidation.ok) {
    invalidParams.push(...referenceValidation.invalidParams);
  }

  if (precedence.mode === "enforce") {
    invalidParams.push(...getV3SurveyPrecedenceInvalidParams(referenceInput));
  } else if (precedence.mode === "introduced") {
    invalidParams.push(
      ...getV3SurveyIntroducedPrecedenceInvalidParams(toReferenceInput(precedence.baseline), referenceInput)
    );
  }

  if (invalidParams.length > 0) {
    return {
      valid: false,
      invalidParams,
    };
  }

  return { valid: true, invalidParams: [] };
}
