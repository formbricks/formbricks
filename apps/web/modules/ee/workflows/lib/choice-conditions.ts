import type { TFunction } from "i18next";
import type { TSurveyMultipleChoiceElement } from "@formbricks/types/surveys/elements";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { type TWorkflowConditionValue, isWorkflowChoiceIds } from "@formbricks/workflows";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import type { TComboboxGroupedOption } from "@/modules/ui/components/input-combo-box";

/**
 * Conditions on a survey choice question (DC11): the If/else and Switch panels offer the question's
 * choices, as the survey flow editor does, and store them by choice id (`{choiceIds}`), which the
 * runner compares as survey logic does. Pure, so it is tested here.
 */

/** The right operand type the kit editor reports for a picked choice. */
export const CHOICE_OPERAND = "choice";

const RESPONSE_PREFIX = "response.";

const LIST_OPERATORS = new Set<string>([
  "equalsOneOf",
  "includesAllOf",
  "includesOneOf",
  "doesNotIncludeAllOf",
  "doesNotIncludeOneOf",
]);

// A multi select's "None" can't be among several picks, so the flow editor leaves it out of these.
const INCLUDES_OPERATORS = new Set<string>([
  "includesOneOf",
  "includesAllOf",
  "doesNotIncludeOneOf",
  "doesNotIncludeAllOf",
]);

/** The single or multi select question a `response.<id>` Variable answers; null for anything else. */
export const getChoiceQuestion = (
  path: string,
  survey: TSurvey | null | undefined
): TSurveyMultipleChoiceElement | null => {
  if (!survey || !path.startsWith(RESPONSE_PREFIX)) return null;
  const id = path.slice(RESPONSE_PREFIX.length);
  const element = getElementsFromBlocks(survey.blocks).find((candidate) => candidate.id === id);
  return element?.type === "multipleChoiceSingle" || element?.type === "multipleChoiceMulti" ? element : null;
};

/** The question's choices as the value picker lists them, under the flow editor's "Choices". */
export const getChoiceValueOptions = (
  question: TSurveyMultipleChoiceElement,
  operator: string,
  t: TFunction
): TComboboxGroupedOption[] => {
  const withoutNone = question.type === "multipleChoiceMulti" && INCLUDES_OPERATORS.has(operator);
  return [
    {
      label: t("common.choices"),
      value: "choices",
      options: question.choices
        .filter((choice) => !withoutNone || choice.id !== "none")
        .map((choice) => ({
          label: getLocalizedValue(choice.label, "default"),
          value: choice.id,
          meta: { type: CHOICE_OPERAND },
        })),
    },
  ];
};

/** Picked choices as a condition stores them: one id for equals / does not equal, else the ids. */
export const toChoiceIdsValue = (
  value: string | number | string[],
  operator: string
): TWorkflowConditionValue | undefined => {
  const ids = (Array.isArray(value) ? value : [value]).map(String).filter((id) => id !== "");
  const kept = LIST_OPERATORS.has(operator) ? ids : ids.slice(0, 1);
  return kept.length > 0 ? { choiceIds: kept } : undefined;
};

/** Stored choice ids as the value picker holds them: a list for list operators, else the one id. */
export const toChoicePickerValue = (value: TWorkflowConditionValue, operator: string): string | string[] => {
  const ids = isWorkflowChoiceIds(value) ? value.choiceIds : [];
  return LIST_OPERATORS.has(operator) ? ids : (ids[0] ?? "");
};

/** Each choice question's choice labels (default language), by Variable path then choice id. */
export type TChoiceLabels = ReadonlyMap<string, ReadonlyMap<string, string>>;

export const getSurveyChoiceLabels = (survey: TSurvey | null | undefined): TChoiceLabels =>
  new Map(
    survey
      ? getElementsFromBlocks(survey.blocks).flatMap((element) =>
          element.type === "multipleChoiceSingle" || element.type === "multipleChoiceMulti"
            ? [
                [
                  `${RESPONSE_PREFIX}${element.id}`,
                  new Map(
                    element.choices.map((choice) => [choice.id, getLocalizedValue(choice.label, "default")])
                  ),
                ] as const,
              ]
            : []
        )
      : []
  );

/**
 * Whether a choice question's value is a label typed before choices were picked by id: the picker
 * keeps its text field for it, so the value stays visible until a choice replaces it.
 */
export const isTypedValue = (rightOperand: { value: unknown; type: string } | undefined): boolean =>
  rightOperand?.type !== CHOICE_OPERAND &&
  rightOperand?.type !== "variable" &&
  typeof rightOperand?.value === "string" &&
  rightOperand.value !== "";
