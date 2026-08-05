import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { ZSegmentFilters } from "@formbricks/types/segment";
import { ZSurveyBlocks } from "@formbricks/types/surveys/blocks";
import {
  type TSurveyType,
  ZSurveyDisplayOption,
  ZSurveyEndings,
  ZSurveyHiddenFields,
  ZSurveyMetadata,
  ZSurveyStatus,
  ZSurveyType,
  ZSurveyVariables,
  ZSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";
import { type InvalidParam, isInvalidParamCode } from "@/app/api/v3/lib/response";
import { normalizeV3SurveyWriteLanguageCode } from "./language";
import { V3_SURVEY_TRANSLATABLE_METADATA_KEYS } from "./translation-fields";

export const DEFAULT_V3_SURVEY_LANGUAGE = "en-US";

export type TV3LanguageCompatibilityOptions = {
  allowedLanguageCodes?: readonly string[];
};

type TV3LanguageNormalizationOptions = TV3LanguageCompatibilityOptions & {
  allowInternalDefaultTranslationKey?: boolean;
};

type TV3SurveyDocumentSchemaOptions = TV3LanguageNormalizationOptions & {
  fallbackDefaultLanguage?: string;
};

const createZV3SurveyLanguageTag = (options?: TV3LanguageCompatibilityOptions) =>
  z
    .string()
    .trim()
    .min(1, "Language code is required")
    .transform((value, ctx) => {
      const normalizedLanguage = normalizeV3SurveyWriteLanguageCode(value, options?.allowedLanguageCodes);

      if (!normalizedLanguage) {
        ctx.addIssue({
          code: "custom",
          message: `Language '${value}' is not a valid locale code`,
          params: { code: "invalid_locale" },
        });
        return z.NEVER;
      }

      return normalizedLanguage;
    });

const createZV3SurveyLanguageInput = (options?: TV3LanguageCompatibilityOptions) =>
  z
    .object({
      code: createZV3SurveyLanguageTag(options),
      default: z.boolean().optional(),
      enabled: z.boolean().prefault(true),
    })
    .strict();

const ZV3SurveyLanguageInput = createZV3SurveyLanguageInput();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublicI18nMapWithOptions(
  value: Record<string, unknown>,
  options?: TV3LanguageNormalizationOptions
): value is Record<string, string> {
  const entries = Object.entries(value);

  return (
    entries.length > 0 &&
    entries.every(([key, entry]) => {
      if (typeof entry !== "string") {
        return false;
      }

      if (key === "default" && options?.allowInternalDefaultTranslationKey) {
        return true;
      }

      return Boolean(normalizeV3SurveyWriteLanguageCode(key, options?.allowedLanguageCodes));
    })
  );
}

function getNormalizedDefaultLanguage(
  value: Record<string, unknown>,
  options?: TV3LanguageNormalizationOptions
): string | null {
  if (value.defaultLanguage === undefined) {
    return DEFAULT_V3_SURVEY_LANGUAGE;
  }

  if (typeof value.defaultLanguage !== "string") {
    return null;
  }

  return normalizeV3SurveyWriteLanguageCode(value.defaultLanguage, options?.allowedLanguageCodes);
}

function normalizePublicI18nMap(
  value: Record<string, string>,
  defaultLanguage: string,
  options?: TV3LanguageNormalizationOptions
): Record<string, string> {
  const normalizedEntries = Object.entries(value).map(([key, entry]) => ({
    key: normalizeV3SurveyWriteLanguageCode(key, options?.allowedLanguageCodes) ?? key,
    entry,
  }));
  const defaultEntry = normalizedEntries.find(
    ({ key }) => key.toLowerCase() === defaultLanguage.toLowerCase()
  );

  if (!defaultEntry) {
    return Object.fromEntries(normalizedEntries.map(({ key, entry }) => [key, entry]));
  }

  const normalized: Record<string, string> = {
    default: defaultEntry.entry,
  };

  for (const { key, entry } of normalizedEntries) {
    if (key !== "default" && key.toLowerCase() !== defaultLanguage.toLowerCase()) {
      normalized[key] = entry;
    }
  }

  return normalized;
}

function normalizePublicI18nField(
  value: unknown,
  defaultLanguage: string,
  options?: TV3LanguageNormalizationOptions
): unknown {
  if (!isPlainObject(value) || !isPublicI18nMapWithOptions(value, options)) {
    return value;
  }

  return normalizePublicI18nMap(value, defaultLanguage, options);
}

function normalizePublicI18nFields(
  value: unknown,
  defaultLanguage: string,
  keys: readonly string[],
  options?: TV3LanguageNormalizationOptions
): unknown {
  if (!isPlainObject(value)) {
    return value;
  }

  const normalized = { ...value };
  for (const key of keys) {
    if (normalized[key] !== undefined) {
      normalized[key] = normalizePublicI18nField(normalized[key], defaultLanguage, options);
    }
  }

  return normalized;
}

function normalizeMetadata(
  value: unknown,
  defaultLanguage: string,
  options?: TV3LanguageNormalizationOptions
): unknown {
  return normalizePublicI18nFields(value, defaultLanguage, V3_SURVEY_TRANSLATABLE_METADATA_KEYS, options);
}

const WELCOME_CARD_I18N_KEYS = ["headline", "subheader", "buttonLabel"] as const;
const BLOCK_I18N_KEYS = ["buttonLabel", "backButtonLabel"] as const;
const ENDING_I18N_KEYS = ["headline", "subheader", "buttonLabel"] as const;
const ELEMENT_I18N_KEYS = [
  "headline",
  "subheader",
  "placeholder",
  "label",
  "otherOptionPlaceholder",
  "lowerLabel",
  "upperLabel",
  "ctaButtonLabel",
  "html",
] as const;
const TOGGLE_INPUT_I18N_KEYS = [
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "zip",
  "country",
  "firstName",
  "lastName",
  "email",
  "phone",
  "company",
] as const;

function normalizeChoice(
  value: unknown,
  defaultLanguage: string,
  options?: TV3LanguageNormalizationOptions
): unknown {
  return normalizePublicI18nFields(value, defaultLanguage, ["label"], options);
}

function normalizeToggleInput(
  value: unknown,
  defaultLanguage: string,
  options?: TV3LanguageNormalizationOptions
): unknown {
  return normalizePublicI18nFields(value, defaultLanguage, ["placeholder"], options);
}

function normalizeElement(
  value: unknown,
  defaultLanguage: string,
  options?: TV3LanguageNormalizationOptions
): unknown {
  if (!isPlainObject(value)) {
    return value;
  }

  const normalized = normalizePublicI18nFields(value, defaultLanguage, ELEMENT_I18N_KEYS, options);
  if (!isPlainObject(normalized)) {
    return value;
  }

  for (const key of TOGGLE_INPUT_I18N_KEYS) {
    if (normalized[key] !== undefined) {
      normalized[key] = normalizeToggleInput(normalized[key], defaultLanguage, options);
    }
  }

  if (Array.isArray(normalized.choices)) {
    normalized.choices = normalized.choices.map((choice) =>
      normalizeChoice(choice, defaultLanguage, options)
    );
  }
  if (Array.isArray(normalized.rows)) {
    normalized.rows = normalized.rows.map((row) => normalizeChoice(row, defaultLanguage, options));
  }
  if (Array.isArray(normalized.columns)) {
    normalized.columns = normalized.columns.map((column) =>
      normalizeChoice(column, defaultLanguage, options)
    );
  }

  return normalized;
}

function normalizeBlock(
  value: unknown,
  defaultLanguage: string,
  options?: TV3LanguageNormalizationOptions
): unknown {
  if (!isPlainObject(value)) {
    return value;
  }

  const normalized = normalizePublicI18nFields(value, defaultLanguage, BLOCK_I18N_KEYS, options);
  if (isPlainObject(normalized) && Array.isArray(normalized.elements)) {
    normalized.elements = normalized.elements.map((element) =>
      normalizeElement(element, defaultLanguage, options)
    );
  }

  return normalized;
}

function normalizeEnding(
  value: unknown,
  defaultLanguage: string,
  options?: TV3LanguageNormalizationOptions
): unknown {
  return normalizePublicI18nFields(value, defaultLanguage, ENDING_I18N_KEYS, options);
}

function addGeneratedId(value: unknown): unknown {
  if (!isPlainObject(value) || value.id !== undefined) {
    return value;
  }

  return {
    ...value,
    id: createId(),
  };
}

function addGeneratedCreateIds(value: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...value };

  if (Array.isArray(normalized.blocks)) {
    normalized.blocks = normalized.blocks.map(addGeneratedId);
  }

  if (Array.isArray(normalized.variables)) {
    normalized.variables = normalized.variables.map(addGeneratedId);
  }

  return normalized;
}

function normalizeV3SurveyDocumentInput(
  value: unknown,
  options: {
    fallbackDefaultLanguage: string;
    applyDefaultLanguage: boolean;
    allowInternalDefaultTranslationKey: boolean;
    generateMissingCreateIds: boolean;
    allowedLanguageCodes?: readonly string[];
  }
): unknown {
  if (!isPlainObject(value)) {
    return value;
  }

  const normalizedDefaultLanguage =
    value.defaultLanguage === undefined ? null : getNormalizedDefaultLanguage(value, options);
  const defaultLanguageForI18n = normalizedDefaultLanguage ?? options.fallbackDefaultLanguage;
  const normalized = { ...value };

  if (value.defaultLanguage === undefined) {
    if (options.applyDefaultLanguage) {
      normalized.defaultLanguage = options.fallbackDefaultLanguage;
    }
  } else {
    normalized.defaultLanguage = normalizedDefaultLanguage ?? value.defaultLanguage;
  }

  if ("metadata" in value) {
    normalized.metadata = normalizeMetadata(value.metadata, defaultLanguageForI18n, options);
  }

  if ("welcomeCard" in value) {
    normalized.welcomeCard = normalizePublicI18nFields(
      value.welcomeCard,
      defaultLanguageForI18n,
      WELCOME_CARD_I18N_KEYS,
      options
    );
  }

  if ("blocks" in value) {
    normalized.blocks = Array.isArray(value.blocks)
      ? value.blocks.map((block) => normalizeBlock(block, defaultLanguageForI18n, options))
      : value.blocks;
  }

  if ("endings" in value) {
    normalized.endings = Array.isArray(value.endings)
      ? value.endings.map((ending) => normalizeEnding(ending, defaultLanguageForI18n, options))
      : value.endings;
  }

  return options.generateMissingCreateIds ? addGeneratedCreateIds(normalized) : normalized;
}

function createV3SurveyDocumentNormalizer(options: {
  fallbackDefaultLanguage?: string;
  applyDefaultLanguage: boolean;
  allowInternalDefaultTranslationKey?: boolean;
  generateMissingCreateIds?: boolean;
  allowedLanguageCodes?: readonly string[];
}) {
  return (value: unknown): unknown =>
    normalizeV3SurveyDocumentInput(value, {
      fallbackDefaultLanguage: options.fallbackDefaultLanguage ?? DEFAULT_V3_SURVEY_LANGUAGE,
      applyDefaultLanguage: options.applyDefaultLanguage,
      allowInternalDefaultTranslationKey: options.allowInternalDefaultTranslationKey ?? false,
      generateMissingCreateIds: options.generateMissingCreateIds ?? false,
      allowedLanguageCodes: options.allowedLanguageCodes,
    });
}

const ROOT_KEYS = new Set([
  "workspaceId",
  "name",
  "type",
  "status",
  "metadata",
  "defaultLanguage",
  "languages",
  "welcomeCard",
  "blocks",
  "endings",
  "hiddenFields",
  "variables",
  "distribution",
  "targeting",
]);
const PATCH_ROOT_KEYS = new Set([
  "name",
  "status",
  "metadata",
  "languages",
  "welcomeCard",
  "blocks",
  "endings",
  "hiddenFields",
  "variables",
  "distribution",
  "targeting",
]);
// Single source of truth for the app-survey distribution scalar columns. Shared with the
// distribution mappers (./distribution) so the field list can't drift across the read/write sites.
export const V3_DISTRIBUTION_SCALAR_KEYS = [
  "displayOption",
  "displayPercentage",
  "displayLimit",
  "recontactDays",
  "autoClose",
  "autoComplete",
  "delay",
] as const;
// App-survey distribution/targeting key sets (validated only when type === "app").
const DISTRIBUTION_KEYS = new Set<string>([...V3_DISTRIBUTION_SCALAR_KEYS, "triggers"]);
const TRIGGER_KEYS = new Set(["actionClassId"]);
const TARGETING_KEYS = new Set(["filters"]);
const LANGUAGE_KEYS = new Set(["code", "default", "enabled"]);
const WELCOME_CARD_KEYS = new Set([
  "enabled",
  "headline",
  "subheader",
  "fileUrl",
  "buttonLabel",
  "timeToFinish",
  "showResponseCount",
  "videoUrl",
]);
const BLOCK_KEYS = new Set([
  "id",
  "name",
  "elements",
  "logic",
  "logicFallback",
  "buttonLabel",
  "backButtonLabel",
]);
const HIDDEN_FIELDS_KEYS = new Set(["enabled", "fieldIds"]);
const VARIABLE_KEYS = new Set(["id", "name", "type", "value"]);
const END_SCREEN_KEYS = new Set([
  "id",
  "type",
  "headline",
  "subheader",
  "buttonLabel",
  "buttonLink",
  "imageUrl",
  "videoUrl",
]);
const REDIRECT_ENDING_KEYS = new Set(["id", "type", "url", "label"]);
const ENDING_REQUIRED_KEYS = ["id", "type"] as const;
const ELEMENT_BASE_KEYS = new Set([
  "id",
  "type",
  "headline",
  "subheader",
  "imageUrl",
  "videoUrl",
  "required",
  "isDraft",
]);
const ELEMENT_REQUIRED_KEYS = ["id", "type", "headline", "required"] as const;
const ALL_ELEMENT_EXTRA_KEYS = new Set([
  "allowMulti",
  "allowMultipleFiles",
  "allowedFileExtensions",
  "addressLine1",
  "addressLine2",
  "buttonExternal",
  "buttonUrl",
  "calHost",
  "calUserName",
  "charLimit",
  "choices",
  "city",
  "columns",
  "company",
  "country",
  "ctaButtonLabel",
  "displayType",
  "email",
  "firstName",
  "format",
  "html",
  "inputType",
  "insightsEnabled",
  "isColorCodingEnabled",
  "label",
  "lastName",
  "longAnswer",
  "lowerLabel",
  "maxSizeInMB",
  "otherOptionPlaceholder",
  "phone",
  "placeholder",
  "rows",
  "shuffleOption",
  "state",
  "upperLabel",
  "validation",
  "zip",
]);
const ELEMENT_KEYS = new Set([...ELEMENT_BASE_KEYS, ...ALL_ELEMENT_EXTRA_KEYS]);
const ELEMENT_KEYS_BY_TYPE = {
  address: new Set([
    ...ELEMENT_BASE_KEYS,
    "addressLine1",
    "addressLine2",
    "city",
    "state",
    "zip",
    "country",
    "validation",
  ]),
  cal: new Set([...ELEMENT_BASE_KEYS, "calUserName", "calHost"]),
  ces: new Set([...ELEMENT_BASE_KEYS, "scale", "range", "lowerLabel", "upperLabel", "isColorCodingEnabled"]),
  consent: new Set([...ELEMENT_BASE_KEYS, "label", "validation"]),
  contactInfo: new Set([
    ...ELEMENT_BASE_KEYS,
    "firstName",
    "lastName",
    "email",
    "phone",
    "company",
    "validation",
  ]),
  csat: new Set([...ELEMENT_BASE_KEYS, "scale", "range", "lowerLabel", "upperLabel", "isColorCodingEnabled"]),
  cta: new Set([...ELEMENT_BASE_KEYS, "buttonExternal", "buttonUrl", "ctaButtonLabel"]),
  date: new Set([...ELEMENT_BASE_KEYS, "html", "format", "validation"]),
  fileUpload: new Set([
    ...ELEMENT_BASE_KEYS,
    "allowMultipleFiles",
    "maxSizeInMB",
    "allowedFileExtensions",
    "validation",
  ]),
  matrix: new Set([...ELEMENT_BASE_KEYS, "rows", "columns", "shuffleOption", "validation"]),
  multipleChoiceMulti: new Set([
    ...ELEMENT_BASE_KEYS,
    "choices",
    "shuffleOption",
    "otherOptionPlaceholder",
    "validation",
    "displayType",
  ]),
  multipleChoiceSingle: new Set([
    ...ELEMENT_BASE_KEYS,
    "choices",
    "shuffleOption",
    "otherOptionPlaceholder",
    "displayType",
  ]),
  nps: new Set([...ELEMENT_BASE_KEYS, "lowerLabel", "upperLabel", "isColorCodingEnabled"]),
  openText: new Set([
    ...ELEMENT_BASE_KEYS,
    "placeholder",
    "longAnswer",
    "inputType",
    "insightsEnabled",
    "charLimit",
    "validation",
  ]),
  pictureSelection: new Set([...ELEMENT_BASE_KEYS, "allowMulti", "choices", "validation"]),
  ranking: new Set([
    ...ELEMENT_BASE_KEYS,
    "choices",
    "otherOptionPlaceholder",
    "shuffleOption",
    "validation",
  ]),
  rating: new Set([
    ...ELEMENT_BASE_KEYS,
    "scale",
    "range",
    "lowerLabel",
    "upperLabel",
    "isColorCodingEnabled",
  ]),
} satisfies Record<string, Set<string>>;
type ElementTypeWithStrictKeys = keyof typeof ELEMENT_KEYS_BY_TYPE;

function isElementTypeWithStrictKeys(type: string): type is ElementTypeWithStrictKeys {
  return Object.hasOwn(ELEMENT_KEYS_BY_TYPE, type);
}
const LABEL_CHOICE_KEYS = new Set(["id", "label"]);
const PICTURE_CHOICE_KEYS = new Set(["id", "imageUrl"]);
const TOGGLE_INPUT_KEYS = new Set(["show", "required", "placeholder"]);
const CHAR_LIMIT_KEYS = new Set(["enabled", "min", "max"]);
const VALIDATION_KEYS = new Set(["rules", "logic"]);
const VALIDATION_RULE_KEYS = new Set(["id", "type", "params", "field"]);
const LOGIC_KEYS = new Set(["id", "conditions", "actions"]);
const CONDITION_GROUP_KEYS = new Set(["id", "connector", "conditions"]);
const CONDITION_KEYS = new Set(["id", "leftOperand", "operator", "rightOperand"]);
const DYNAMIC_REFERENCE_KEYS = new Set(["type", "value", "meta"]);
const STATIC_OPERAND_KEYS = new Set(["type", "value"]);
const CALCULATE_ACTION_KEYS = new Set(["id", "objective", "variableId", "operator", "value"]);
const REQUIRE_ANSWER_ACTION_KEYS = new Set(["id", "objective", "target"]);
const JUMP_TO_BLOCK_ACTION_KEYS = REQUIRE_ANSWER_ACTION_KEYS;

function addUnknownKeyIssues(
  value: unknown,
  allowedKeys: Set<string>,
  path: string,
  issues: InvalidParam[],
  context?: string
): void {
  if (!isPlainObject(value)) {
    return;
  }

  const allowedFields = context
    ? Array.from(allowedKeys)
        .sort((left, right) => left.localeCompare(right))
        .join(", ")
    : "";

  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      issues.push({
        name: path ? `${path}.${key}` : key,
        reason: context
          ? `Unsupported field '${key}' for ${context}. Allowed fields: ${allowedFields}`
          : `Unsupported field '${key}'`,
        code: "unsupported_field",
      });
    }
  }
}

function addMissingRequiredKeyIssues(
  value: unknown,
  requiredKeys: readonly string[],
  path: string,
  issues: InvalidParam[],
  context: string
): void {
  if (!isPlainObject(value)) {
    return;
  }

  for (const key of requiredKeys) {
    if (value[key] === undefined) {
      issues.push({
        name: path ? `${path}.${key}` : key,
        reason: `Missing required field '${key}' for ${context}`,
        code: "missing_required_field",
      });
    }
  }
}

function getInvalidParamZodParams(issue: InvalidParam): Omit<InvalidParam, "name" | "reason"> | null {
  const { name: _name, reason: _reason, ...params } = issue;
  return Object.keys(params).length > 0 ? params : null;
}

function addInvalidParamZodIssue(ctx: z.RefinementCtx, issue: InvalidParam): void {
  const params = getInvalidParamZodParams(issue);

  ctx.addIssue({
    code: "custom",
    message: issue.reason,
    path: issue.name ? issue.name.split(".") : [],
    ...(params ? { params } : {}),
  });
}

function validateTranslatableField(
  value: unknown,
  path: string,
  issues: InvalidParam[],
  defaultLanguage: string | null,
  options?: TV3LanguageCompatibilityOptions
): void {
  if (!isPlainObject(value)) {
    return;
  }

  if ("default" in value) {
    issues.push({
      name: `${path}.default`,
      reason: "Use the defaultLanguage locale code instead of the internal 'default' translation key",
    });
  }

  const normalizedKeys = new Map<string, string>();
  let includesDefaultLanguage = defaultLanguage === null;

  for (const key of Object.keys(value)) {
    if (key === "default") {
      continue;
    }

    const normalizedKey = normalizeV3SurveyWriteLanguageCode(key, options?.allowedLanguageCodes);
    if (!normalizedKey) {
      issues.push({
        name: `${path}.${key}`,
        reason: `Language key '${key}' is not a valid locale code`,
        code: "invalid_locale",
      });
      continue;
    }

    const normalizedKeyLookup = normalizedKey.toLowerCase();
    const previousKey = normalizedKeys.get(normalizedKeyLookup);
    if (previousKey) {
      issues.push({
        name: `${path}.${key}`,
        reason: `Language key '${key}' duplicates '${previousKey}' after locale normalization`,
        code: "duplicate_locale",
      });
      continue;
    }

    normalizedKeys.set(normalizedKeyLookup, key);
    if (normalizedKeyLookup === defaultLanguage?.toLowerCase()) {
      includesDefaultLanguage = true;
    }
  }

  if (!includesDefaultLanguage) {
    issues.push({
      name: path,
      reason: `Translatable field must include the defaultLanguage locale '${defaultLanguage}'`,
    });
  }
}

function validateChoice(
  value: unknown,
  path: string,
  issues: InvalidParam[],
  defaultLanguage: string | null,
  allowedKeys: Set<string>,
  options?: TV3LanguageCompatibilityOptions
): void {
  const choiceContext = allowedKeys === PICTURE_CHOICE_KEYS ? "pictureSelection choice" : "choice";
  addUnknownKeyIssues(value, allowedKeys, path, issues, choiceContext);
  if (isPlainObject(value)) {
    validateTranslatableField(value.label, `${path}.label`, issues, defaultLanguage, options);
  }
}

function validateToggleInput(
  value: unknown,
  path: string,
  issues: InvalidParam[],
  defaultLanguage: string | null,
  options?: TV3LanguageCompatibilityOptions
): void {
  addUnknownKeyIssues(value, TOGGLE_INPUT_KEYS, path, issues);
  if (isPlainObject(value)) {
    validateTranslatableField(value.placeholder, `${path}.placeholder`, issues, defaultLanguage, options);
  }
}

function validateValidation(value: unknown, path: string, issues: InvalidParam[]): void {
  addUnknownKeyIssues(value, VALIDATION_KEYS, path, issues);
  if (!isPlainObject(value) || !Array.isArray(value.rules)) {
    return;
  }

  value.rules.forEach((rule, index) => {
    const rulePath = `${path}.rules.${index}`;
    addUnknownKeyIssues(rule, VALIDATION_RULE_KEYS, rulePath, issues);
  });
}

function validateDynamicReference(value: unknown, path: string, issues: InvalidParam[]): void {
  addUnknownKeyIssues(value, DYNAMIC_REFERENCE_KEYS, path, issues);
}

function validateLogicOperand(value: unknown, path: string, issues: InvalidParam[]): void {
  if (!isPlainObject(value)) {
    return;
  }

  if (value.type === "static") {
    addUnknownKeyIssues(value, STATIC_OPERAND_KEYS, path, issues);
    return;
  }

  validateDynamicReference(value, path, issues);
}

function validateConditionGroup(value: unknown, path: string, issues: InvalidParam[]): void {
  addUnknownKeyIssues(value, CONDITION_GROUP_KEYS, path, issues);
  if (!isPlainObject(value) || !Array.isArray(value.conditions)) {
    return;
  }

  value.conditions.forEach((condition, index) => {
    const conditionPath = `${path}.conditions.${index}`;
    if (isPlainObject(condition) && Array.isArray(condition.conditions)) {
      validateConditionGroup(condition, conditionPath, issues);
      return;
    }

    addUnknownKeyIssues(condition, CONDITION_KEYS, conditionPath, issues);
    if (isPlainObject(condition)) {
      validateDynamicReference(condition.leftOperand, `${conditionPath}.leftOperand`, issues);
      validateLogicOperand(condition.rightOperand, `${conditionPath}.rightOperand`, issues);
    }
  });
}

function validateAction(value: unknown, path: string, issues: InvalidParam[]): void {
  if (!isPlainObject(value)) {
    return;
  }

  if (value.objective === "calculate") {
    addUnknownKeyIssues(value, CALCULATE_ACTION_KEYS, path, issues);
    validateLogicOperand(value.value, `${path}.value`, issues);
    return;
  }

  if (value.objective === "requireAnswer") {
    addUnknownKeyIssues(value, REQUIRE_ANSWER_ACTION_KEYS, path, issues);
    return;
  }

  if (value.objective === "jumpToBlock") {
    addUnknownKeyIssues(value, JUMP_TO_BLOCK_ACTION_KEYS, path, issues);
  }
}

function validateBlockLogic(value: unknown, path: string, issues: InvalidParam[]): void {
  addUnknownKeyIssues(value, LOGIC_KEYS, path, issues);
  if (!isPlainObject(value)) {
    return;
  }

  validateConditionGroup(value.conditions, `${path}.conditions`, issues);

  if (Array.isArray(value.actions)) {
    value.actions.forEach((action, index) => validateAction(action, `${path}.actions.${index}`, issues));
  }
}

function validateElement(
  value: unknown,
  path: string,
  issues: InvalidParam[],
  defaultLanguage: string | null,
  options?: TV3LanguageCompatibilityOptions
): void {
  let elementKeys = ELEMENT_KEYS;
  if (isPlainObject(value) && typeof value.type === "string" && isElementTypeWithStrictKeys(value.type)) {
    elementKeys = ELEMENT_KEYS_BY_TYPE[value.type];
  }

  const elementContext =
    isPlainObject(value) && typeof value.type === "string"
      ? `element type '${value.type}'`
      : "survey element";
  addMissingRequiredKeyIssues(value, ELEMENT_REQUIRED_KEYS, path, issues, elementContext);
  addUnknownKeyIssues(value, elementKeys, path, issues, elementContext);
  if (!isPlainObject(value)) {
    return;
  }

  ELEMENT_I18N_KEYS.forEach((key) =>
    validateTranslatableField(value[key], `${path}.${key}`, issues, defaultLanguage, options)
  );
  TOGGLE_INPUT_I18N_KEYS.forEach((key) =>
    validateToggleInput(value[key], `${path}.${key}`, issues, defaultLanguage, options)
  );

  if (isPlainObject(value.charLimit)) {
    addUnknownKeyIssues(value.charLimit, CHAR_LIMIT_KEYS, `${path}.charLimit`, issues);
  }

  validateValidation(value.validation, `${path}.validation`, issues);

  if (Array.isArray(value.choices)) {
    const choiceKeys = value.type === "pictureSelection" ? PICTURE_CHOICE_KEYS : LABEL_CHOICE_KEYS;
    value.choices.forEach((choice, index) =>
      validateChoice(choice, `${path}.choices.${index}`, issues, defaultLanguage, choiceKeys, options)
    );
  }

  if (Array.isArray(value.rows)) {
    value.rows.forEach((row, index) =>
      validateChoice(row, `${path}.rows.${index}`, issues, defaultLanguage, LABEL_CHOICE_KEYS, options)
    );
  }

  if (Array.isArray(value.columns)) {
    value.columns.forEach((column, index) =>
      validateChoice(column, `${path}.columns.${index}`, issues, defaultLanguage, LABEL_CHOICE_KEYS, options)
    );
  }
}

function validateBlock(
  value: unknown,
  path: string,
  issues: InvalidParam[],
  defaultLanguage: string | null,
  options?: TV3LanguageCompatibilityOptions
): void {
  addUnknownKeyIssues(value, BLOCK_KEYS, path, issues);
  if (!isPlainObject(value)) {
    return;
  }

  validateTranslatableField(value.buttonLabel, `${path}.buttonLabel`, issues, defaultLanguage, options);
  validateTranslatableField(
    value.backButtonLabel,
    `${path}.backButtonLabel`,
    issues,
    defaultLanguage,
    options
  );

  if (Array.isArray(value.elements)) {
    value.elements.forEach((element, index) =>
      validateElement(element, `${path}.elements.${index}`, issues, defaultLanguage, options)
    );
  }

  if (Array.isArray(value.logic)) {
    value.logic.forEach((logic, index) => validateBlockLogic(logic, `${path}.logic.${index}`, issues));
  }
}

function validateEnding(
  value: unknown,
  path: string,
  issues: InvalidParam[],
  defaultLanguage: string | null,
  options?: TV3LanguageCompatibilityOptions
): void {
  if (!isPlainObject(value)) {
    return;
  }

  const isRedirectEnding = value.type === "redirectToUrl";
  const endingKeys = isRedirectEnding ? REDIRECT_ENDING_KEYS : END_SCREEN_KEYS;
  const endingContext = typeof value.type === "string" ? `ending type '${value.type}'` : "survey ending";

  addMissingRequiredKeyIssues(value, ENDING_REQUIRED_KEYS, path, issues, endingContext);
  addUnknownKeyIssues(value, endingKeys, path, issues, endingContext);
  ENDING_I18N_KEYS.forEach((key) =>
    validateTranslatableField(value[key], `${path}.${key}`, issues, defaultLanguage, options)
  );
}

function validateTrigger(value: unknown, path: string, issues: InvalidParam[]): void {
  addMissingRequiredKeyIssues(value, ["actionClassId"], path, issues, "survey trigger");
  addUnknownKeyIssues(value, TRIGGER_KEYS, path, issues, "survey trigger");
}

function validateDistribution(value: unknown, path: string, issues: InvalidParam[]): void {
  addUnknownKeyIssues(value, DISTRIBUTION_KEYS, path, issues, "survey distribution");
  if (isPlainObject(value) && Array.isArray(value.triggers)) {
    value.triggers.forEach((trigger, index) => validateTrigger(trigger, `${path}.triggers.${index}`, issues));
  }
}

function validateTargeting(value: unknown, path: string, issues: InvalidParam[]): void {
  addUnknownKeyIssues(value, TARGETING_KEYS, path, issues, "survey targeting");
}

function getUnsupportedV3SurveyDocumentFields(
  value: unknown,
  rootKeys: Set<string>,
  fallbackDefaultLanguage = DEFAULT_V3_SURVEY_LANGUAGE,
  options?: TV3LanguageCompatibilityOptions
): InvalidParam[] {
  const issues: InvalidParam[] = [];
  // Include the allowed top-level fields in the error so agents/clients can self-correct from the
  // message alone (mirrors the per-element/block unknown-key errors).
  addUnknownKeyIssues(value, rootKeys, "", issues, "the survey document");

  if (!isPlainObject(value)) {
    return issues;
  }

  const defaultLanguage =
    value.defaultLanguage === undefined
      ? fallbackDefaultLanguage
      : getNormalizedDefaultLanguage(value, options);

  Array.isArray(value.languages) &&
    value.languages.forEach((language, index) =>
      addUnknownKeyIssues(language, LANGUAGE_KEYS, `languages.${index}`, issues)
    );
  addUnknownKeyIssues(value.welcomeCard, WELCOME_CARD_KEYS, "welcomeCard", issues);
  if (isPlainObject(value.welcomeCard)) {
    const welcomeCard = value.welcomeCard;
    WELCOME_CARD_I18N_KEYS.forEach((key) =>
      validateTranslatableField(welcomeCard[key], `welcomeCard.${key}`, issues, defaultLanguage, options)
    );
  }
  addUnknownKeyIssues(value.hiddenFields, HIDDEN_FIELDS_KEYS, "hiddenFields", issues);
  Array.isArray(value.variables) &&
    value.variables.forEach((variable, index) =>
      addUnknownKeyIssues(variable, VARIABLE_KEYS, `variables.${index}`, issues)
    );
  Array.isArray(value.blocks) &&
    value.blocks.forEach((block, index) =>
      validateBlock(block, `blocks.${index}`, issues, defaultLanguage, options)
    );
  Array.isArray(value.endings) &&
    value.endings.forEach((ending, index) =>
      validateEnding(ending, `endings.${index}`, issues, defaultLanguage, options)
    );

  const metadata = value.metadata;
  if (isPlainObject(metadata)) {
    V3_SURVEY_TRANSLATABLE_METADATA_KEYS.forEach((key) =>
      validateTranslatableField(metadata[key], `metadata.${key}`, issues, defaultLanguage, options)
    );
  }

  if ("distribution" in value) {
    validateDistribution(value.distribution, "distribution", issues);
  }
  if ("targeting" in value) {
    validateTargeting(value.targeting, "targeting", issues);
  }

  return issues;
}

function addLanguageIssues(
  survey: {
    defaultLanguage?: string;
    languages?: z.infer<typeof ZV3SurveyLanguageInput>[];
  },
  ctx: z.RefinementCtx
): void {
  const normalizedDefaultLanguage = survey.defaultLanguage?.toLowerCase();
  const seenLanguageCodes = new Set<string>();
  let defaultLanguageEntryCount = 0;

  for (const [index, language] of (survey.languages ?? []).entries()) {
    const normalizedLanguageCode = language.code.toLowerCase();

    if (seenLanguageCodes.has(normalizedLanguageCode)) {
      ctx.addIssue({
        code: "custom",
        message: `Language '${language.code}' is duplicated`,
        params: { code: "duplicate_locale" },
        path: ["languages", index, "code"],
      });
    }
    seenLanguageCodes.add(normalizedLanguageCode);

    if (language.default) {
      defaultLanguageEntryCount += 1;
      if (normalizedDefaultLanguage && normalizedLanguageCode !== normalizedDefaultLanguage) {
        ctx.addIssue({
          code: "custom",
          message: "The default language entry must match defaultLanguage",
          path: ["languages", index, "default"],
        });
      }
    }

    if (
      normalizedDefaultLanguage &&
      normalizedLanguageCode === normalizedDefaultLanguage &&
      !language.enabled
    ) {
      ctx.addIssue({
        code: "custom",
        message: "The default language cannot be disabled",
        path: ["languages", index, "enabled"],
      });
    }
  }

  if (defaultLanguageEntryCount > 1) {
    ctx.addIssue({
      code: "custom",
      message: "Only one language can be marked as default",
      path: ["languages"],
    });
  }
}

const ZV3SurveyName = z.string().trim().min(1, "Survey name is required");
const ZV3SurveyBlocks = ZSurveyBlocks.min(1, "At least one block is required");

// App-survey trigger references an existing workspace action class by id.
// Existence/uniqueness is validated against workspace action classes at write time.
const ZV3SurveyTrigger = z.object({ actionClassId: z.cuid2() }).strict();

/**
 * App-survey runtime/distribution settings. Scalar defaults mirror the Survey DB defaults so a
 * provided `distribution` object fully determines the runtime config (top-level replacement semantics).
 * Only honored when `type === "app"`; rejected for link surveys (see addAppDistributionIssues).
 */
const ZV3SurveyDistribution = z
  .object({
    displayOption: ZSurveyDisplayOption.prefault("displayOnce"),
    displayPercentage: z.number().min(0.01).max(100).nullable().prefault(null),
    displayLimit: z.number().int().nonnegative().nullable().prefault(null),
    recontactDays: z.number().int().nonnegative().nullable().prefault(null),
    autoClose: z.number().int().nonnegative().nullable().prefault(null),
    autoComplete: z.number().int().min(1, "Response limit must be greater than 0").nullable().prefault(null),
    delay: z.number().int().nonnegative().prefault(0),
    triggers: z.array(ZV3SurveyTrigger).prefault([]),
  })
  .strict();

// App-survey contact targeting. `filters: []` means "show to everyone".
const ZV3SurveyTargeting = z.object({ filters: ZSegmentFilters }).strict();

/**
 * Body-level validation for app-survey distribution/targeting: `distribution`/`targeting` are
 * app-only, so reject them on explicit `link` surveys. Within `distribution`, `displaySome` ("show a
 * limited number of times") must carry a `displayLimit` >= 1 (mirrors the editor's required "show
 * maximum of N times" input). `displayPercentage` is an INDEPENDENT throttle valid with ANY
 * `displayOption` — never coupled to `displaySome` — matching `ZSurvey` and the js-core runtime.
 */
function addAppDistributionIssues(
  survey: {
    distribution?: z.infer<typeof ZV3SurveyDistribution>;
    targeting?: z.infer<typeof ZV3SurveyTargeting>;
  },
  surveyType: TSurveyType | undefined,
  ctx: z.RefinementCtx
): void {
  if (surveyType === "link") {
    if (survey.distribution !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "'distribution' is only supported for app surveys (type: 'app')",
        params: { code: "unsupported_field" },
        path: ["distribution"],
      });
    }
    if (survey.targeting !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "'targeting' is only supported for app surveys (type: 'app')",
        params: { code: "unsupported_field" },
        path: ["targeting"],
      });
    }
    return;
  }

  // "displaySome" is capped by displayLimit, so a "limited" survey must specify a real limit (>= 1),
  // mirroring the editor. displayPercentage stays independent and is validated by the field schema.
  const distribution = survey.distribution;
  if (
    distribution?.displayOption === "displaySome" &&
    (distribution.displayLimit === null ||
      distribution.displayLimit === undefined ||
      distribution.displayLimit < 1)
  ) {
    ctx.addIssue({
      code: "custom",
      message: "displayLimit must be at least 1 when displayOption is 'displaySome'",
      params: { code: "missing_required_field" },
      path: ["distribution", "displayLimit"],
    });
  }
}

function createV3SurveyDocumentShape(options?: TV3LanguageCompatibilityOptions) {
  return {
    name: ZV3SurveyName,
    status: ZSurveyStatus.prefault("draft"),
    metadata: ZSurveyMetadata.prefault({}),
    defaultLanguage: createZV3SurveyLanguageTag(options).prefault(DEFAULT_V3_SURVEY_LANGUAGE),
    languages: z.array(createZV3SurveyLanguageInput(options)).prefault([]),
    welcomeCard: ZSurveyWelcomeCard.prefault({ enabled: false }),
    blocks: ZV3SurveyBlocks,
    endings: ZSurveyEndings.prefault([]),
    hiddenFields: ZSurveyHiddenFields.prefault({ enabled: false }),
    variables: ZSurveyVariables.prefault([]),
    distribution: ZV3SurveyDistribution.optional(),
    targeting: ZV3SurveyTargeting.optional(),
  };
}

function createV3SurveyPatchShape(options?: TV3LanguageCompatibilityOptions) {
  return {
    name: ZV3SurveyName.optional(),
    status: ZSurveyStatus.optional(),
    metadata: ZSurveyMetadata.optional(),
    languages: z.array(createZV3SurveyLanguageInput(options)).optional(),
    welcomeCard: ZSurveyWelcomeCard.optional(),
    blocks: ZV3SurveyBlocks.optional(),
    endings: ZSurveyEndings.optional(),
    hiddenFields: ZSurveyHiddenFields.optional(),
    variables: ZSurveyVariables.optional(),
    distribution: ZV3SurveyDistribution.optional(),
    targeting: ZV3SurveyTargeting.optional(),
  };
}

const V3_SURVEY_DOCUMENT_SHAPE = createV3SurveyDocumentShape();

export function createZV3SurveyDocumentBaseSchema(options?: TV3SurveyDocumentSchemaOptions) {
  return z.preprocess(
    createV3SurveyDocumentNormalizer({
      allowInternalDefaultTranslationKey: options?.allowInternalDefaultTranslationKey,
      fallbackDefaultLanguage: options?.fallbackDefaultLanguage,
      applyDefaultLanguage: true,
      allowedLanguageCodes: options?.allowedLanguageCodes,
    }),
    z.object(createV3SurveyDocumentShape(options)).strict().superRefine(addLanguageIssues)
  );
}

export const ZV3SurveyDocumentBase = createZV3SurveyDocumentBaseSchema();

const ZV3CreateSurveyBodyBase = z.preprocess(
  createV3SurveyDocumentNormalizer({ applyDefaultLanguage: true, generateMissingCreateIds: true }),
  z
    .object({
      workspaceId: z.cuid2(),
      type: ZSurveyType.prefault("link"),
      ...V3_SURVEY_DOCUMENT_SHAPE,
    })
    .strict()
    .superRefine(addLanguageIssues)
    .superRefine((body, ctx) => addAppDistributionIssues(body, body.type, ctx))
);

export const ZV3CreateSurveyBody = z
  .unknown()
  .superRefine((value, ctx) => {
    for (const issue of getUnsupportedV3SurveyDocumentFields(value, ROOT_KEYS)) {
      addInvalidParamZodIssue(ctx, issue);
    }
  })
  .pipe(ZV3CreateSurveyBodyBase);

export const ZV3CreateSurveyQuery = z.object({
  createdFrom: z.enum(["blank", "template", "xm-template", "ai"]).optional(),
});

export type TV3CreateSurveyQuery = z.infer<typeof ZV3CreateSurveyQuery>;

function createV3PatchSurveyBodyBase(
  defaultLanguage: string,
  options?: TV3LanguageCompatibilityOptions,
  surveyType?: TSurveyType
) {
  return z.preprocess(
    createV3SurveyDocumentNormalizer({
      fallbackDefaultLanguage: defaultLanguage,
      applyDefaultLanguage: false,
      allowedLanguageCodes: options?.allowedLanguageCodes,
    }),
    z
      .object(createV3SurveyPatchShape(options))
      .strict()
      .superRefine((body, ctx) => addLanguageIssues({ ...body, defaultLanguage }, ctx))
      .superRefine((body, ctx) => addAppDistributionIssues(body, surveyType, ctx))
      .refine((body) => Object.keys(body).length > 0, {
        message: "Request body must include at least one updatable field",
      })
  );
}

export function createZV3PatchSurveyBodySchema(
  defaultLanguage = DEFAULT_V3_SURVEY_LANGUAGE,
  options?: TV3LanguageCompatibilityOptions,
  surveyType?: TSurveyType
) {
  return z
    .unknown()
    .superRefine((value, ctx) => {
      for (const issue of getUnsupportedV3SurveyDocumentFields(
        value,
        PATCH_ROOT_KEYS,
        defaultLanguage,
        options
      )) {
        addInvalidParamZodIssue(ctx, issue);
      }
    })
    .pipe(createV3PatchSurveyBodyBase(defaultLanguage, options, surveyType));
}

export const ZV3PatchSurveyBody = createZV3PatchSurveyBodySchema();

export const ZV3SurveyValidationRequestBody = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("create"),
      data: z.unknown(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("patch"),
      surveyId: z.cuid2(),
      data: z.unknown(),
    })
    .strict(),
]);

export const ZV3EmptyQuery = z.object({}).strict();

export function formatV3ZodInvalidParams(error: z.ZodError, fallbackName: string): InvalidParam[] {
  return error.issues.map((issue) => {
    const params = "params" in issue && isPlainObject(issue.params) ? issue.params : {};
    const code = isInvalidParamCode(params.code) ? params.code : undefined;

    return {
      name: issue.path.length > 0 ? issue.path.join(".") : fallbackName,
      reason: issue.message,
      ...(code ? { code } : {}),
    };
  });
}

export type TV3SurveyDocument = z.infer<typeof ZV3SurveyDocumentBase>;
export type TV3CreateSurveyBody = z.infer<typeof ZV3CreateSurveyBody>;
export type TV3PatchSurveyBody = z.infer<typeof ZV3PatchSurveyBody>;
export type TV3SurveyValidationRequestBody = z.infer<typeof ZV3SurveyValidationRequestBody>;
export type TV3SurveyDistribution = z.infer<typeof ZV3SurveyDistribution>;
export type TV3SurveyTargeting = z.infer<typeof ZV3SurveyTargeting>;
export type TV3SurveyTrigger = z.infer<typeof ZV3SurveyTrigger>;
