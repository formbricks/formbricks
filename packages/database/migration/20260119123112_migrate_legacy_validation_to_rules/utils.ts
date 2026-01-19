import { v7 as uuidv7 } from "uuid";
import type { SurveyElement, ValidationRule } from "./types";

/**
 * Check if a validation rule with matching type and params already exists
 */
export function hasMatchingRule(
  rules: ValidationRule[],
  type: string,
  params: Record<string, unknown>
): boolean {
  return rules.some((rule) => rule.type === type && JSON.stringify(rule.params) === JSON.stringify(params));
}

/**
 * Initialize validation object if it doesn't exist
 */
export function ensureValidationObject(element: SurveyElement): void {
  if (!element.validation) {
    element.validation = {
      rules: [],
      logic: "and",
    };
  }
  if (!element.validation.rules) {
    element.validation.rules = [];
  }
  if (!element.validation.logic) {
    element.validation.logic = "and";
  }
}

/**
 * Migrate Open Text element charLimit to validation rules
 * Always removes legacy charLimit field after processing
 * Throws error if transformation fails
 */
export function migrateOpenTextCharLimit(element: SurveyElement): void {
  // Skip if charLimit is missing or not enabled (already migrated)
  if (
    !element.charLimit ||
    element.charLimit.enabled !== true ||
    (element.charLimit.min === undefined && element.charLimit.max === undefined)
  ) {
    // Still remove legacy field if it exists but is disabled
    if (element.charLimit) {
      delete element.charLimit;
    }
    return;
  }

  // Ensure validation object exists
  ensureValidationObject(element);

  const existingRules = element.validation!.rules;

  // Migrate minLength if min is defined and valid
  if (
    element.charLimit.min !== undefined &&
    element.charLimit.min >= 0 &&
    !hasMatchingRule(existingRules, "minLength", { min: element.charLimit.min })
  ) {
    const newRule: ValidationRule = {
      id: uuidv7(),
      type: "minLength",
      params: { min: element.charLimit.min },
    };
    existingRules.push(newRule);
  }

  // Migrate maxLength if max is defined and valid
  if (
    element.charLimit.max !== undefined &&
    element.charLimit.max >= 0 &&
    !hasMatchingRule(existingRules, "maxLength", {
      max: element.charLimit.max,
    })
  ) {
    const newRule: ValidationRule = {
      id: uuidv7(),
      type: "maxLength",
      params: { max: element.charLimit.max },
    };
    existingRules.push(newRule);
  }

  // Always remove legacy charLimit field after processing
  delete element.charLimit;
}

/**
 * Check if two arrays contain the same extensions (order-independent)
 */
function extensionsMatch(extensions1: string[], extensions2: string[]): boolean {
  if (extensions1.length !== extensions2.length) {
    return false;
  }
  const sorted1 = [...extensions1].sort();
  const sorted2 = [...extensions2].sort();
  return JSON.stringify(sorted1) === JSON.stringify(sorted2);
}

/**
 * Migrate File Upload element allowedFileExtensions to validation rules
 * Always removes legacy allowedFileExtensions field after processing
 * Throws error if transformation fails
 */
export function migrateFileUploadExtensions(element: SurveyElement): void {
  // Skip if allowedFileExtensions is missing or empty (already migrated)
  if (
    !element.allowedFileExtensions ||
    !Array.isArray(element.allowedFileExtensions) ||
    element.allowedFileExtensions.length === 0
  ) {
    // Still remove legacy field if it exists but is empty
    if (element.allowedFileExtensions) {
      delete element.allowedFileExtensions;
    }
    return;
  }

  // Ensure validation object exists
  ensureValidationObject(element);

  const existingRules = element.validation!.rules;
  const extensions = element.allowedFileExtensions;

  // Check if a matching fileExtensionIs rule already exists
  const hasMatchingExtensionRule = existingRules.some(
    (rule) =>
      rule.type === "fileExtensionIs" &&
      rule.params.extensions &&
      Array.isArray(rule.params.extensions) &&
      extensionsMatch(rule.params.extensions, extensions)
  );

  if (!hasMatchingExtensionRule) {
    // Create new fileExtensionIs rule
    const newRule: ValidationRule = {
      id: uuidv7(),
      type: "fileExtensionIs",
      params: { extensions: [...extensions] },
    };
    existingRules.push(newRule);
  }

  // Always remove legacy allowedFileExtensions field after processing
  delete element.allowedFileExtensions;
}

/**
 * Migrate a single survey's blocks
 * Throws error if any element fails to transform
 */
export function migrateSurveyBlocks(blocks: { id: string; elements: SurveyElement[] }[]): void {
  for (const block of blocks) {
    for (const element of block.elements) {
      // Skip if element type is not OpenText or FileUpload
      if (element.type !== "openText" && element.type !== "fileUpload") {
        continue;
      }

      // Migrate Open Text elements - throws if transformation fails
      if (element.type === "openText") {
        migrateOpenTextCharLimit(element);
      }

      // Migrate File Upload elements - throws if transformation fails
      if (element.type === "fileUpload") {
        migrateFileUploadExtensions(element);
      }
    }
  }
}
