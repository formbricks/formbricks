import { findBlocksWithCyclicLogic } from "@formbricks/types/surveys/blocks-validation";
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
 * Blocks whose conditional logic forms a cycle (ENG-3946): a respondent can loop between them
 * forever without ever reaching an ending.
 *
 * The detection and the wording are the ones `surveyRefinement` already applies on create
 * (`ZSurveyCreateInput`), down to the path and the sentence — so the create and the update paths
 * refuse the same document for the same stated reason, and there is one cycle-finder, not two.
 */
export function getV3SurveyCyclicLogicInvalidParams(blocks: TV3SurveyDocument["blocks"]): InvalidParam[] {
  return findBlocksWithCyclicLogic(blocks).flatMap((blockId) => {
    const blockIndex = blocks.findIndex((block) => block.id === blockId);
    if (blockIndex === -1) {
      return [];
    }

    return [
      {
        name: `blocks.${String(blockIndex)}.logic`,
        reason: `Conditional Logic: Cyclic logic detected in block ${String(blockIndex + 1)} (${blocks[blockIndex].name}).`,
      },
    ];
  });
}

/**
 * Whether the cyclic-logic rule is applied here (ENG-3946).
 *
 * `enforce` on the patch family: PATCH and both block endpoints write the whole `blocks` array, so
 * every one of them persists the cycle — including a request that only reorders, or only renames the
 * survey. `skip` on create, which already rejects cycles a layer down through `ZSurveyCreateInput`;
 * running the rule here too would move that 422 ahead of create's permission and limit checks and
 * change a response that is correct today. Required rather than defaulted, like the precedence
 * policy above, so a new caller has to choose.
 */
export type TV3SurveyCyclicLogicPolicy = "enforce" | "skip";

/**
 * How strictly to apply the ordering rules (ENG-3069).
 *
 * `introduced` on the patch family (PATCH, block edit, reorder): only what the change adds is reported —
 * enforcing the full set would make a survey that already contains a forward recall unpatchable,
 * including by a request that never touches it. `skip` on create, which accepted these documents before
 * the rule existed (see `prepareV3SurveyCreate` for why that stays). `enforce` is kept for the rollout
 * that tightens create and is reached by no production caller today. The parameter is required rather
 * than defaulted so a new caller has to choose.
 */
export type TV3SurveyPrecedencePolicy =
  | { mode: "enforce" }
  | { mode: "introduced"; baseline: TV3SurveyDocument }
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
  precedence: TV3SurveyPrecedencePolicy,
  cyclicLogic: TV3SurveyCyclicLogicPolicy
): TV3SurveyDocumentValidationResult {
  const languageInvalidParams = getV3SurveyLanguageInvalidParams(document);
  const mediaInvalidParams = getV3SurveyMediaInvalidParams(document.blocks);
  const invalidParams = [...languageInvalidParams, ...mediaInvalidParams];

  const referenceInput = toReferenceInput(document);
  const referenceValidation = validateV3SurveyReferences(referenceInput);

  if (!referenceValidation.ok) {
    invalidParams.push(...referenceValidation.invalidParams);
  }

  if (cyclicLogic === "enforce") {
    invalidParams.push(...getV3SurveyCyclicLogicInvalidParams(document.blocks));
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
