import type { TFunction } from "i18next";
import {
  SHOW_CONDITION_BROWSERS,
  SHOW_CONDITION_DEVICE_TYPES,
  SHOW_CONDITION_OPERANDS,
  SHOW_CONDITION_OPERATORS,
  type TShowConditionBrowser,
  type TShowConditionDeviceType,
  type TShowConditionOperand,
  type TShowConditionOperandType,
  type TShowConditionOperator,
} from "@formbricks/types/show-conditions";
import type { TComboboxGroupedOption, TComboboxOption } from "@/modules/ui/components/input-combo-box";

// Tables of literal `t("…")` calls rather than of key strings, so the translation scanner sees every
// key as used (see `field-display.ts` for why that matters).

const GROUP_LABELS: Record<TShowConditionOperandType, (t: TFunction) => string> = {
  page: (t) => t("workspace.surveys.edit.show_conditions.group_page"),
  visit: (t) => t("workspace.surveys.edit.show_conditions.group_visit"),
  device: (t) => t("workspace.surveys.edit.show_conditions.group_device"),
};

const OPERAND_LABELS: Record<TShowConditionOperand, (t: TFunction) => string> = {
  currentUrl: (t) => t("workspace.surveys.edit.show_conditions.operand_current_url"),
  queryParam: (t) => t("workspace.surveys.edit.show_conditions.operand_query_parameter"),
  pageReferrer: (t) => t("workspace.surveys.edit.show_conditions.operand_page_referrer"),
  entryReferrer: (t) => t("workspace.surveys.edit.show_conditions.operand_entry_referrer"),
  visitedUrls: (t) => t("workspace.surveys.edit.show_conditions.operand_visited_url"),
  pagesViewed: (t) => t("workspace.surveys.edit.show_conditions.operand_pages_viewed"),
  uniquePagesViewed: (t) => t("workspace.surveys.edit.show_conditions.operand_unique_pages_viewed"),
  timeOnSite: (t) => t("workspace.surveys.edit.show_conditions.operand_time_on_site"),
  deviceType: (t) => t("workspace.surveys.edit.show_conditions.operand_device"),
  browser: (t) => t("workspace.surveys.edit.show_conditions.operand_browser"),
  screenWidth: (t) => t("workspace.surveys.edit.show_conditions.operand_window_width"),
};

const OPERATOR_LABELS: Record<TShowConditionOperator, (t: TFunction) => string> = {
  equals: (t) => t("workspace.surveys.edit.show_conditions.operator_is"),
  doesNotEqual: (t) => t("workspace.surveys.edit.show_conditions.operator_is_not"),
  contains: (t) => t("workspace.surveys.edit.show_conditions.operator_contains"),
  doesNotContain: (t) => t("workspace.surveys.edit.show_conditions.operator_does_not_contain"),
  startsWith: (t) => t("workspace.surveys.edit.show_conditions.operator_starts_with"),
  endsWith: (t) => t("workspace.surveys.edit.show_conditions.operator_ends_with"),
  containsAnyOf: (t) => t("workspace.surveys.edit.show_conditions.operator_contains_any_of"),
  containsNoneOf: (t) => t("workspace.surveys.edit.show_conditions.operator_contains_none_of"),
  pathIsAnyOf: (t) => t("workspace.surveys.edit.show_conditions.operator_path_is_any_of"),
  pathIsNoneOf: (t) => t("workspace.surveys.edit.show_conditions.operator_path_is_none_of"),
  isGreaterThan: (t) => t("workspace.surveys.edit.show_conditions.operator_is_more_than"),
  isLessThan: (t) => t("workspace.surveys.edit.show_conditions.operator_is_less_than"),
  isGreaterThanOrEqual: (t) => t("workspace.surveys.edit.show_conditions.operator_is_at_least"),
  isLessThanOrEqual: (t) => t("workspace.surveys.edit.show_conditions.operator_is_at_most"),
  includes: (t) => t("workspace.surveys.edit.show_conditions.operator_includes"),
  doesNotInclude: (t) => t("workspace.surveys.edit.show_conditions.operator_does_not_include"),
  isSet: (t) => t("workspace.surveys.edit.show_conditions.operator_is_set"),
  isNotSet: (t) => t("workspace.surveys.edit.show_conditions.operator_is_not_set"),
};

const DEVICE_LABELS: Record<TShowConditionDeviceType, (t: TFunction) => string> = {
  desktop: (t) => t("workspace.surveys.edit.show_conditions.device_desktop"),
  tablet: (t) => t("workspace.surveys.edit.show_conditions.device_tablet"),
  phone: (t) => t("workspace.surveys.edit.show_conditions.device_phone"),
};

const BROWSER_LABELS: Record<TShowConditionBrowser, (t: TFunction) => string> = {
  chrome: (t) => t("workspace.surveys.edit.show_conditions.browser_chrome"),
  safari: (t) => t("workspace.surveys.edit.show_conditions.browser_safari"),
  firefox: (t) => t("workspace.surveys.edit.show_conditions.browser_firefox"),
  edge: (t) => t("workspace.surveys.edit.show_conditions.browser_edge"),
  opera: (t) => t("workspace.surveys.edit.show_conditions.browser_opera"),
  samsung: (t) => t("workspace.surveys.edit.show_conditions.browser_samsung"),
  other: (t) => t("workspace.surveys.edit.show_conditions.browser_other"),
};

/** The operand order in the picker: the mock's order, page first, then the visit, then the device. */
const OPERAND_ORDER: Record<TShowConditionOperandType, TShowConditionOperand[]> = {
  page: ["currentUrl", "queryParam", "pageReferrer", "entryReferrer"],
  visit: ["visitedUrls", "pagesViewed", "uniquePagesViewed", "timeOnSite"],
  device: ["deviceType", "browser", "screenWidth"],
};

export const getShowConditionOperandOptions = (t: TFunction): TComboboxGroupedOption[] =>
  (Object.keys(SHOW_CONDITION_OPERANDS) as TShowConditionOperandType[]).map((type) => ({
    label: GROUP_LABELS[type](t),
    value: type,
    options: OPERAND_ORDER[type].map((operand) => ({
      label: OPERAND_LABELS[operand](t),
      value: operand,
      meta: { type },
    })),
  }));

export const getShowConditionOperatorOptions = (
  operand: TShowConditionOperand,
  t: TFunction
): TComboboxOption[] =>
  SHOW_CONDITION_OPERATORS[operand].map((operator: TShowConditionOperator) => ({
    label: OPERATOR_LABELS[operator](t),
    value: operator,
  }));

/** The fixed values for the device and browser operands; `undefined` for free-entry operands. */
export const getShowConditionValueOptions = (
  operand: TShowConditionOperand,
  t: TFunction
): TComboboxGroupedOption[] | undefined => {
  if (operand === "deviceType") {
    return [
      {
        label: OPERAND_LABELS.deviceType(t),
        value: operand,
        options: SHOW_CONDITION_DEVICE_TYPES.map((value) => ({ label: DEVICE_LABELS[value](t), value })),
      },
    ];
  }
  if (operand === "browser") {
    return [
      {
        label: OPERAND_LABELS.browser(t),
        value: operand,
        options: SHOW_CONDITION_BROWSERS.map((value) => ({ label: BROWSER_LABELS[value](t), value })),
      },
    ];
  }
  return undefined;
};

export const getShowConditionOperandLabel = (operand: TShowConditionOperand, t: TFunction): string =>
  OPERAND_LABELS[operand](t);

export const getShowConditionOperatorLabel = (operator: TShowConditionOperator, t: TFunction): string =>
  OPERATOR_LABELS[operator](t);
