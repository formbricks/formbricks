import {
  TSurveyElement,
  TSurveyElementTypeEnum,
  TSurveyOpenTextElementInputType,
} from "@formbricks/types/surveys/elements";
import {
  TAddressField,
  TContactInfoField,
  TValidationRule,
  TValidationRuleType,
} from "@formbricks/types/surveys/validation-rules";
import { RULE_TYPE_CONFIG } from "./validation-rules-config";

/**
 * The OpenText invariant: no validation rules means `inputType` must be `"text"`.
 *
 * The editor derives "validation is on" from the rule count, so any path that empties the rule list
 * has to reset `inputType` too — otherwise the section reads as off while the element still carries
 * `inputType: "number" | "email" | "url" | "phone"`, the Long answer toggle stays disabled, and the
 * rendered input keeps enforcing browser-native format validation for respondents.
 *
 * `remainingRuleCount` is the count *after* the change, so deleting one of several rules leaves
 * `inputType` alone.
 */
export const shouldResetInputTypeToText = (
  elementType: TSurveyElementTypeEnum,
  remainingRuleCount: number,
  inputType?: TSurveyOpenTextElementInputType
): boolean =>
  elementType === TSurveyElementTypeEnum.OpenText &&
  remainingRuleCount === 0 &&
  inputType !== undefined &&
  inputType !== "text";

/**
 * The full state transition for deleting one validation rule: the remaining rules plus whether the
 * caller must also reset `inputType` to `"text"`.
 *
 * Returning both together is the point. Deleting the last rule and switching the section off used to
 * be two code paths and only the latter reset `inputType`, so the editor could leave an OpenText
 * element with zero rules and `inputType: "number"`. Computing the new rule list without being
 * handed that decision is now impossible.
 *
 * The deletion path deliberately resets only `number`, which is narrower than `handleDisable`.
 * Toggling the section off is an explicit "stop validating this" action, and `main` already clears
 * any non-text `inputType` there. Deleting one rule is not that action, and zero rules with a
 * non-text `inputType` is shipped data rather than the bug state: `app/lib/templates.ts` builds
 * OpenText elements with `inputType: "email"`, `longAnswer: false` and no `validation` key at all
 * (lines 139, 281, 2431). Resetting those on a trash-icon click would flip `longAnswer` to true via
 * `open-element-form.tsx`, turning a template email question into a textarea that still shows
 * `example@email.com`. `number` is the one case ENG-2419 reports and the one where the leftover type
 * is vestigial — set by adding a number rule, and keeping Long answer disabled with nothing left
 * enforcing it.
 */
export const applyRuleDeletion = (
  rules: TValidationRule[],
  ruleId: string,
  elementType: TSurveyElementTypeEnum,
  inputType?: TSurveyOpenTextElementInputType
): { rules: TValidationRule[]; resetInputTypeToText: boolean } => {
  const remaining = rules.filter((rule) => rule.id !== ruleId);
  return {
    rules: remaining,
    resetInputTypeToText:
      inputType === "number" && shouldResetInputTypeToText(elementType, remaining.length, inputType),
  };
};

// Field options for address elements
export const getAddressFields = (t: (key: string) => string): { value: TAddressField; label: string }[] => [
  { value: "addressLine1", label: t("workspace.surveys.edit.address_line_1") },
  { value: "addressLine2", label: t("workspace.surveys.edit.address_line_2") },
  { value: "city", label: t("workspace.surveys.edit.city") },
  { value: "state", label: t("workspace.surveys.edit.state") },
  { value: "zip", label: t("workspace.surveys.edit.zip") },
  { value: "country", label: t("workspace.surveys.edit.country") },
];

// Field options for contact info elements
export const getContactInfoFields = (
  t: (key: string) => string
): { value: TContactInfoField; label: string }[] => [
  { value: "firstName", label: t("workspace.surveys.edit.first_name") },
  { value: "lastName", label: t("workspace.surveys.edit.last_name") },
  { value: "email", label: t("common.email") },
  { value: "phone", label: t("common.phone") },
  { value: "company", label: t("workspace.surveys.edit.company") },
];

// Rule labels mapping
export const getRuleLabels = (t: (key: string) => string): Record<string, string> => ({
  min_length: t("workspace.surveys.edit.validation.min_length"),
  max_length: t("workspace.surveys.edit.validation.max_length"),
  pattern: t("workspace.surveys.edit.validation.pattern"),
  email: t("workspace.surveys.edit.validation.email"),
  url: t("workspace.surveys.edit.validation.url"),
  phone: t("workspace.surveys.edit.validation.phone"),
  min_value: t("workspace.surveys.edit.validation.min_value"),
  max_value: t("workspace.surveys.edit.validation.max_value"),
  min_selections: t("workspace.surveys.edit.validation.min_selections"),
  max_selections: t("workspace.surveys.edit.validation.max_selections"),
  characters: t("workspace.surveys.edit.validation.characters"),
  options_selected: t("workspace.surveys.edit.validation.options_selected"),
  is: t("workspace.surveys.edit.validation.is"),
  is_not: t("workspace.surveys.edit.validation.is_not"),
  contains: t("workspace.surveys.edit.validation.contains"),
  does_not_contain: t("workspace.surveys.edit.validation.does_not_contain"),
  is_greater_than: t("workspace.surveys.edit.validation.is_greater_than"),
  is_less_than: t("workspace.surveys.edit.validation.is_less_than"),
  is_later_than: t("workspace.surveys.edit.validation.is_later_than"),
  is_earlier_than: t("workspace.surveys.edit.validation.is_earlier_than"),
  is_between: t("workspace.surveys.edit.validation.is_between"),
  is_not_between: t("workspace.surveys.edit.validation.is_not_between"),
  minimum_options_ranked: t("workspace.surveys.edit.validation.minimum_options_ranked"),
  rank_all_options: t("workspace.surveys.edit.validation.rank_all_options"),
  minimum_rows_answered: t("workspace.surveys.edit.validation.minimum_rows_answered"),
  answer_all_rows: t("workspace.surveys.edit.validation.answer_all_rows"),
  file_extension_is: t("workspace.surveys.edit.validation.file_extension_is"),
  file_extension_is_not: t("workspace.surveys.edit.validation.file_extension_is_not"),
  kb: t("workspace.surveys.edit.validation.kb"),
  mb: t("workspace.surveys.edit.validation.mb"),
});

// Helper function to get default value for a validation rule based on its config and element
export const getDefaultRuleValue = (
  config: (typeof RULE_TYPE_CONFIG)[TValidationRuleType],
  element?: TSurveyElement
): number | string | undefined => {
  if (!config.needsValue) {
    return undefined;
  }

  if (config.valueType === "text") {
    return "";
  }

  if (config.valueType === "option") {
    if (element && "choices" in element) {
      const firstChoice = element.choices.find((c) => c.id !== "other" && c.id !== "none");
      return firstChoice?.id ?? "";
    }
    return "";
  }

  if (config.valueType === "ranking") {
    if (element && "choices" in element) {
      const firstChoice = element.choices.find((c) => c.id !== "other" && c.id !== "none");
      return firstChoice ? `${firstChoice.id},1` : ",1";
    }
    return ",1";
  }

  return undefined;
};

// Helper function to normalize file extension format
export const normalizeFileExtension = (value: string): string => {
  return value.startsWith(".") ? value : `.${value}`;
};

// Helper function to parse and validate rule value based on rule type
export const parseRuleValue = (
  ruleType: TValidationRuleType,
  value: string,
  config: (typeof RULE_TYPE_CONFIG)[TValidationRuleType]
): string | number => {
  // Handle file extension formatting: auto-add dot if missing
  if (ruleType === "fileExtensionIs" || ruleType === "fileExtensionIsNot") {
    return normalizeFileExtension(value);
  }

  if (config.valueType === "number") {
    // `onKeyDown` blocks the exponent keys but not paste, and `Number()` happily reads `1e5` as
    // 100000. Accept only a plain decimal — optionally signed, since the numeric rule params are
    // bare `z.number()` and a negative threshold is legitimate — and treat anything else as 0.
    // The fractional part is one group starting with the literal `.` rather than `\.?\d*`: the
    // latter lets a digit run be split between two `\d*`, so a long non-numeric paste backtracks
    // quadratically (Sonar S8786). Same accepted strings, linear time.
    if (!/^-?\d*(\.\d*)?$/.test(value.trim())) return 0;
    // The regex admits an arbitrarily long digit run, and `Number()` turns anything past ~1e308 into
    // `Infinity`, which is truthy — so `Number(value) || 0` let it through. `createMinParams` /
    // `createMaxParams` are also truthy-guarded, so it reached the stored rule, and `JSON.stringify`
    // writes `Infinity` as `null`: a 400-digit paste stored `{ max: null }` against a `z.number()`
    // param. `NaN` (from a lone `-`, `.` or `-.`, which the regex also admits) was already caught by
    // the truthy guard; requiring a finite number covers both without relying on falsiness.
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return value;
};
