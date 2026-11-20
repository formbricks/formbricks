import type { TFunction } from "i18next";
import { RESERVED_FIELD_CATALOG, getSurveyEmbeddedFields } from "@formbricks/types/embedded-data-resolver";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  type TWorkflowSurveyConditionOperator,
  WORKFLOW_SURVEY_CONDITION_OPERATORS,
} from "@formbricks/workflows";
import { getConditionOperatorOptions } from "@/modules/ee/workflows/lib/if-else-conditions";
import type { TWorkflowVariableTypeHint } from "@/modules/ee/workflows/lib/variable-picker";
import { getLogicRules } from "@/modules/survey/editor/lib/logic-rule-engine";
import { getElementOperatorOptions } from "@/modules/survey/editor/lib/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { withComparisonPills } from "@/modules/ui/components/conditions-editor/lib/sentence";
import type { TComboboxOption } from "@/modules/ui/components/input-combo-box";

/**
 * The operators an If/else or Switch offers for a survey Variable, the same list and words the survey
 * flow editor shows for that question type or field type, so a condition reads the same in both.
 *
 * A workflow runs on a finished response, which records an answer or none: the survey's answer-state
 * operators keep their words and compare presence (Is submitted is Is set). Operators a finished
 * response can't settle (partly submitted, the matrix and address ones) are left out.
 */

const RESPONSE_PREFIX = "response.";

const SUPPORTED = new Set<string>(WORKFLOW_SURVEY_CONDITION_OPERATORS);

const ANSWER_STATE_OPERATORS: Record<string, TWorkflowSurveyConditionOperator> = {
  isSubmitted: "isSet",
  isSkipped: "isNotSet",
  isAccepted: "isSet",
  isClicked: "isSet",
  isNotClicked: "isNotSet",
  isBooked: "isSet",
};

const toWorkflowOperators = (options: readonly TComboboxOption[]): TComboboxOption[] => {
  const seen = new Set<string>();
  const result: TComboboxOption[] = [];
  for (const option of options) {
    const name = String(option.value);
    const value = SUPPORTED.has(name) ? name : ANSWER_STATE_OPERATORS[name];
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push({ label: option.label, value });
  }
  return result;
};

/** Null for a path that isn't one of the survey's own Variables, which keeps its type-based list. */
export const getSurveyVariableOperatorOptions = (
  path: string,
  survey: TSurvey | null | undefined,
  t: TFunction
): TComboboxOption[] | null => {
  if (!survey || !path.startsWith(RESPONSE_PREFIX)) return null;
  const key = path.slice(RESPONSE_PREFIX.length);

  const element = getElementsFromBlocks(survey.blocks).find((candidate) => candidate.id === key);
  if (element) {
    const options = toWorkflowOperators(getElementOperatorOptions(element, t));
    return options.length > 0 ? options : null;
  }

  const dataType =
    getSurveyEmbeddedFields(survey).find(({ link }) => link.storageKey === key)?.field.dataType ??
    RESERVED_FIELD_CATALOG.find((entry) => entry.name === key)?.dataType;
  if (!dataType) return null;
  return toWorkflowOperators(getLogicRules(t)[`field.${dataType}`].options);
};

/**
 * The operator list with the condition's own operator kept: one stored before the list changed (or
 * written through the API) still shows, under the generic list's label for it.
 */
export const withStoredOperator = (
  options: TComboboxOption[],
  operator: string,
  fallback: readonly TComboboxOption[]
): TComboboxOption[] => {
  if (options.some((option) => option.value === operator)) return options;
  const stored = fallback.find((option) => option.value === operator);
  return stored ? [...options, stored] : options;
};

/**
 * A condition's operator list: the survey flow editor's for a survey Variable, the type-based one
 * for anything else, with number comparisons as the same symbol pills the flow editor draws.
 */
export const getVariableOperatorOptions = ({
  path,
  operator,
  survey,
  typeHint,
  t,
}: {
  path: string;
  operator: string;
  survey: TSurvey | null | undefined;
  typeHint: TWorkflowVariableTypeHint | undefined;
  t: TFunction;
}): TComboboxOption[] => {
  const fromSurvey = getSurveyVariableOperatorOptions(path, survey, t);
  const options = fromSurvey
    ? withStoredOperator(fromSurvey, operator, getConditionOperatorOptions(undefined, t))
    : getConditionOperatorOptions(typeHint, t);
  return withComparisonPills(options);
};
