import { TSurveyElementTypeEnum, TSurveyOpenTextElementInputType } from "@formbricks/types/surveys/elements";
import {
  APPLICABLE_RULES,
  MAX_RELATIVE_DATE_AMOUNT,
  TAddressField,
  TContactInfoField,
  TRelativeDateBound,
  TValidationRule,
  TValidationRuleType,
} from "@formbricks/types/surveys/validation-rules";
import { formatLocalDay, parseLocalDay } from "@/lib/utils/datetime";

const stringRules: TValidationRuleType[] = [
  "minLength",
  "maxLength",
  "pattern",
  "equals",
  "doesNotEqual",
  "contains",
  "doesNotContain",
];

// Rules applicable per field for Address elements
// General text fields don't support format-specific validators (email, url, phone)
export const RULES_BY_ADDRESS_FIELD: Record<TAddressField, TValidationRuleType[]> = {
  addressLine1: stringRules,
  addressLine2: stringRules,
  city: stringRules,
  state: stringRules,
  zip: stringRules,
  country: stringRules,
};

// Rules applicable per field for Contact Info elements
// Note: "email" and "phone" validation are automatically enforced for their respective fields
// and should not appear as selectable options in the UI
export const RULES_BY_CONTACT_INFO_FIELD: Record<TContactInfoField, TValidationRuleType[]> = {
  firstName: stringRules,
  lastName: stringRules,
  email: stringRules,
  phone: ["equals", "doesNotEqual", "contains", "doesNotContain"],
  company: stringRules,
};

// Rules applicable per input type for OpenText
export const RULES_BY_INPUT_TYPE: Record<TSurveyOpenTextElementInputType, TValidationRuleType[]> = {
  text: [
    "minLength",
    "maxLength",
    "pattern",
    // "email", "url", "phone" excluded - redundant for text inputType
    "equals",
    "doesNotEqual",
    "contains",
    "doesNotContain",
  ],
  email: [
    "minLength",
    "maxLength",
    "pattern",
    // "email" rule excluded - redundant when inputType=email (HTML5 already validates)
    "equals",
    "doesNotEqual",
    "contains",
    "doesNotContain",
  ],
  url: [
    "minLength",
    "maxLength",
    "pattern",
    // "url" rule excluded - redundant when inputType=url (HTML5 already validates)
    "equals",
    "doesNotEqual",
    "contains",
    "doesNotContain",
  ],
  phone: [
    "minLength",
    "maxLength",
    "pattern",
    // "phone" rule excluded - redundant when inputType=phone (HTML5 already validates)
    "equals",
    "doesNotEqual",
    "contains",
    "doesNotContain",
  ],
  number: ["minValue", "maxValue", "equals", "doesNotEqual"],
};

export const DATE_RULE_TYPES: TValidationRuleType[] = [
  "isLaterThan",
  "isEarlierThan",
  "isBetween",
  "isNotBetween",
];

const RANGE_DATE_RULE_TYPES = new Set<TValidationRuleType>(["isBetween", "isNotBetween"]);

/**
 * Whole days inside the range ZRelativeDateBound accepts. Without the clamp the editor's number
 * field takes an amount the schema rejects, and the author only finds out when the survey fails
 * to save. Anything unparseable reads as 0, the same as an emptied field.
 */
export const clampRelativeAmount = (raw: string): number => {
  const parsed = Math.trunc(Number(raw));
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(MAX_RELATIVE_DATE_AMOUNT, Math.max(0, parsed));
};

export const DEFAULT_RELATIVE_BOUND: TRelativeDateBound = {
  amount: 0,
  unit: "calendarDays",
  direction: "before",
};

/** The `yyyy-MM-dd` shape a fixed date rule stores. */
const ISO_DAY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** True when a rule's params hold relative bounds rather than fixed calendar dates. */
export const isRelativeDateParams = (params: TValidationRule["params"]): boolean =>
  "relative" in params || ("relativeStart" in params && "relativeEnd" in params);

/**
 * Parses a fixed date rule value (`yyyy-MM-dd`) into the local-midnight Date the shared picker takes.
 * Returns null for an unset or malformed value, which is what an untouched rule holds.
 */
export const parseDateRuleValue = (value: string | undefined): Date | null => {
  if (!value || !ISO_DAY_REGEX.test(value)) return null;

  const parsed = parseLocalDay(value);
  // Rejects a well-formed but impossible day (2026-02-30), which Date would silently roll over.
  return Number.isNaN(parsed.getTime()) || formatLocalDay(parsed) !== value ? null : parsed;
};

/** Splits a stored `"start,end"` range value into its two bounds. */
export const parseDateRangeRuleValue = (
  value: string | undefined
): { from: Date | null; to: Date | null } => {
  const [start, end] = (value ?? "").split(",");

  return { from: parseDateRuleValue(start?.trim()), to: parseDateRuleValue(end?.trim()) };
};

/** Default params when a date rule is switched into relative mode. */
export const createRelativeDateParams = (ruleType: TValidationRuleType): TValidationRule["params"] => {
  if (RANGE_DATE_RULE_TYPES.has(ruleType)) {
    return {
      relativeStart: { ...DEFAULT_RELATIVE_BOUND },
      relativeEnd: { ...DEFAULT_RELATIVE_BOUND, direction: "after" },
    };
  }
  return { relative: { ...DEFAULT_RELATIVE_BOUND } };
};

type TTranslate = (key: string, options?: Record<string, string | number>) => string;

/** "the submission day" | "3 calendar days before submission" - one complete phrase per unit and direction. */
const describeRelativeBound = (bound: TRelativeDateBound, t: TTranslate): string => {
  if (bound.amount === 0) return t("workspace.surveys.edit.validation.relative_bound_submission_day");

  const count = bound.amount;
  if (bound.unit === "workingDays") {
    return bound.direction === "before"
      ? t("workspace.surveys.edit.validation.relative_bound_working_days_before", { count })
      : t("workspace.surveys.edit.validation.relative_bound_working_days_after", { count });
  }
  return bound.direction === "before"
    ? t("workspace.surveys.edit.validation.relative_bound_calendar_days_before", { count })
    : t("workspace.surveys.edit.validation.relative_bound_calendar_days_after", { count });
};

/**
 * One plain sentence saying which dates a relative rule accepts, so the author reads the rule the
 * way the respondent will meet it. Returns null for fixed-date params and non-date rules.
 *
 * Each bound is a whole phrase carrying its own ICU plural, and every sentence places it after a
 * colon ("Earliest accepted date: …") rather than inside a clause, so no locale has to agree case or
 * word order with an inserted fragment. The wording is inclusive on purpose: the relative validators
 * compare with >= / <=, unlike the strict fixed-date comparison.
 */
export const describeRelativeDateRule = (
  ruleType: TValidationRuleType,
  params: TValidationRule["params"],
  t: TTranslate
): string | null => {
  if (!isRelativeDateParams(params)) return null;

  const { relative, relativeStart, relativeEnd } = params as {
    relative?: TRelativeDateBound;
    relativeStart?: TRelativeDateBound;
    relativeEnd?: TRelativeDateBound;
  };

  let sentence: string | null = null;
  const bounds: TRelativeDateBound[] = [];

  if (ruleType === "isLaterThan" && relative) {
    bounds.push(relative);
    sentence = t("workspace.surveys.edit.validation.relative_summary_later_than", {
      bound: describeRelativeBound(relative, t),
    });
  } else if (ruleType === "isEarlierThan" && relative) {
    bounds.push(relative);
    sentence = t("workspace.surveys.edit.validation.relative_summary_earlier_than", {
      bound: describeRelativeBound(relative, t),
    });
  } else if (RANGE_DATE_RULE_TYPES.has(ruleType) && relativeStart && relativeEnd) {
    bounds.push(relativeStart, relativeEnd);
    const range = {
      start: describeRelativeBound(relativeStart, t),
      end: describeRelativeBound(relativeEnd, t),
    };
    sentence =
      ruleType === "isBetween"
        ? t("workspace.surveys.edit.validation.relative_summary_between", range)
        : t("workspace.surveys.edit.validation.relative_summary_not_between", range);
  }

  if (sentence === null) return null;

  const usesWorkingDays = bounds.some((bound) => bound.unit === "workingDays" && bound.amount > 0);
  return usesWorkingDays
    ? `${sentence} ${t("workspace.surveys.edit.validation.relative_summary_working_days_note")}`
    : sentence;
};

/**
 * Get available rule types for an element type, excluding already added rules
 * For OpenText elements, filters rules based on inputType
 * For Address/ContactInfo elements, filters rules based on field
 */
export const getAvailableRuleTypes = (
  elementType: TSurveyElementTypeEnum,
  existingRules: TValidationRule[],
  inputType?: TSurveyOpenTextElementInputType,
  field?: TAddressField | TContactInfoField
): TValidationRuleType[] => {
  const elementTypeKey = elementType.toString();

  // For OpenText, use input-type-based filtering
  if (elementType === TSurveyElementTypeEnum.OpenText && inputType) {
    const applicable = RULES_BY_INPUT_TYPE[inputType] ?? [];
    const existingTypes = new Set(existingRules.map((r) => r.type));
    return applicable.filter((ruleType) => !existingTypes.has(ruleType));
  }

  // For Address elements, use field-based filtering
  if (elementType === TSurveyElementTypeEnum.Address) {
    if (!field) {
      // Address elements require a field to be specified for validation rules
      return [];
    }
    const applicable = RULES_BY_ADDRESS_FIELD[field as TAddressField] ?? [];
    const existingTypes = new Set(existingRules.map((r) => r.type));
    return applicable.filter((ruleType) => !existingTypes.has(ruleType));
  }

  // For Contact Info elements, use field-based filtering
  if (elementType === TSurveyElementTypeEnum.ContactInfo) {
    if (!field) {
      // Contact Info elements require a field to be specified for validation rules
      return [];
    }
    const applicable = RULES_BY_CONTACT_INFO_FIELD[field as TContactInfoField] ?? [];
    const existingTypes = new Set(existingRules.map((r) => r.type));
    return applicable.filter((ruleType) => !existingTypes.has(ruleType));
  }

  if (elementType === TSurveyElementTypeEnum.PictureSelection) {
    const applicable = APPLICABLE_RULES[elementTypeKey] ?? [];
    const existingTypes = new Set(existingRules.map((r) => r.type));
    return applicable.filter((ruleType) => !existingTypes.has(ruleType));
  }

  // For other element types, use standard filtering
  const applicable = APPLICABLE_RULES[elementTypeKey] ?? [];
  const existingTypes = new Set(existingRules.map((r) => r.type));

  return applicable.filter((ruleType) => {
    // Allow only one of each rule type
    return !existingTypes.has(ruleType);
  });
};

/**
 * Get the value from rule params based on rule type
 */
export const getRuleValue = (rule: TValidationRule): number | string | undefined => {
  const params = rule.params;
  // Relative date params are edited through their own inputs, not the shared string channel.
  if (isRelativeDateParams(params)) return undefined;
  if ("min" in params) return params.min;
  if ("max" in params) return params.max;
  if ("pattern" in params) {
    const pattern = params.pattern;
    return pattern ?? "";
  }
  if ("value" in params) {
    return params.value;
  }
  if ("date" in params) {
    return params.date;
  }
  if ("startDate" in params && "endDate" in params) {
    return `${params.startDate},${params.endDate}`;
  }
  if ("extensions" in params) {
    // For file extension rules, return extensions array as comma-separated string for display
    const extensions = params.extensions;
    return extensions.length > 0 ? extensions.join(", ") : "";
  }
  return undefined;
};

/**
 * Helper functions to create params for different rule types
 */
const createStringValueParams = (value?: number | string) => ({
  value: value === undefined || value === null ? "" : String(value),
});

const createMinParams = (value?: number | string, defaultValue = 0) => ({
  min: Number(value) || defaultValue,
});

const createMaxParams = (value?: number | string, defaultValue = 100) => ({
  max: Number(value) || defaultValue,
});

const createDateParams = (value?: number | string) => ({
  date: value === undefined || value === null ? "" : String(value),
});

const createDateRangeParams = (value?: number | string) => {
  if (typeof value === "string" && value.includes(",")) {
    const [startDate, endDate] = value.split(",");
    return {
      startDate: startDate?.trim() || "",
      endDate: endDate?.trim() || "",
    };
  }
  return { startDate: "", endDate: "" };
};

const createFileExtensionParams = (value?: number | string) => {
  if (Array.isArray(value)) {
    return { extensions: value };
  }
  if (typeof value === "string" && value.includes(",")) {
    return { extensions: value.split(",").map((ext) => ext.trim()) };
  }
  const extensionValue = value === undefined || value === null ? "" : String(value);
  return { extensions: extensionValue ? [extensionValue] : [] };
};

/**
 * Create params object from rule type and value (without type field)
 */
export const createRuleParams = (
  ruleType: TValidationRuleType,
  value?: number | string
): TValidationRule["params"] => {
  // Rules that return empty params
  if (
    ruleType === "email" ||
    ruleType === "url" ||
    ruleType === "phone" ||
    ruleType === "rankAll" ||
    ruleType === "answerAllRows"
  ) {
    return {};
  }

  // Rules that use string value params
  if (
    ruleType === "equals" ||
    ruleType === "doesNotEqual" ||
    ruleType === "contains" ||
    ruleType === "doesNotContain"
  ) {
    return createStringValueParams(value);
  }

  // Rules that use min params
  if (
    ruleType === "minLength" ||
    ruleType === "minValue" ||
    ruleType === "isGreaterThan" ||
    ruleType === "minSelections" ||
    ruleType === "minRanked" ||
    ruleType === "minRowsAnswered"
  ) {
    const defaultValue =
      ruleType === "minSelections" || ruleType === "minRanked" || ruleType === "minRowsAnswered" ? 1 : 0;
    return createMinParams(value, defaultValue);
  }

  // Rules that use max params
  if (
    ruleType === "maxLength" ||
    ruleType === "maxValue" ||
    ruleType === "isLessThan" ||
    ruleType === "maxSelections"
  ) {
    const defaultValue = ruleType === "maxSelections" ? 3 : 100;
    return createMaxParams(value, defaultValue);
  }

  // Rules that use date params
  if (ruleType === "isLaterThan" || ruleType === "isEarlierThan") {
    return createDateParams(value);
  }

  // Rules that use date range params
  if (ruleType === "isBetween" || ruleType === "isNotBetween") {
    return createDateRangeParams(value);
  }

  // Rules that use file extension params
  if (ruleType === "fileExtensionIs" || ruleType === "fileExtensionIsNot") {
    return createFileExtensionParams(value);
  }

  // Pattern rule
  if (ruleType === "pattern") {
    return { pattern: value === undefined || value === null ? "" : String(value) };
  }

  return {};
};
