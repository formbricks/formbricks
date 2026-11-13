import {
  findComputedEmbeddedField,
  getComputedEmbeddedFields,
  getComputedFieldDataType,
  getLogicVariableValue,
  getSurveyEmbeddedFields,
} from "@formbricks/types/embedded-data-resolver";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TResponseData, type TResponseVariables } from "@formbricks/types/responses";
import { type TActionCalculate, type TSurveyBlockLogicAction } from "@formbricks/types/surveys/blocks";
import { compareConditionValues } from "@formbricks/types/surveys/condition-comparison";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { compareDateValues, isDateFieldOperand } from "@formbricks/types/surveys/date-comparison";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import { evaluateSetValue } from "@formbricks/types/surveys/expression-evaluation";
import { findByLocalizedLabel, findMatrixRowKey } from "@formbricks/types/surveys/localized-label";
import { type TConditionGroup, type TSingleCondition } from "@formbricks/types/surveys/logic";
import {
  evaluateConditionGroup,
  evaluateUnansweredCondition,
} from "@formbricks/types/surveys/logic-evaluation";
import {
  isMatrixRowCondition,
  namesUnknownMatrixId,
  resolveMatrixColumnValue,
  resolveMatrixRowIndex,
} from "@formbricks/types/surveys/matrix-conditions";
import { getElementsFromSurveyBlocks } from "./utils";

type TCondition = TSingleCondition | TConditionGroup;

export const isConditionGroup = (condition: TCondition): condition is TConditionGroup => {
  return (condition as TConditionGroup).connector !== undefined;
};

/**
 * @param embeddedValues Reserved-field values merged UNDER `data` by `mergeReservedValues` — the map
 *   a `reserved` operand reads. Only that operand consults it; the `element` and `hiddenField` arms
 *   keep reading `data` alone, so a declared field that happens to share a reserved name can never
 *   pick up reserved metadata just because the respondent left it blank. Defaults to `{}` so a
 *   caller with nothing to project evaluates exactly as it does today, and every reserved operand
 *   reads as unset rather than throwing.
 */
export const evaluateLogic = (
  localSurvey: TJsWorkspaceStateSurvey,
  data: TResponseData,
  variablesData: TResponseVariables,
  conditions: TConditionGroup,
  selectedLanguage: string,
  embeddedValues: TResponseData = {}
): boolean =>
  evaluateConditionGroup(conditions, (condition) =>
    evaluateSingleCondition(localSurvey, data, variablesData, condition, selectedLanguage, embeddedValues)
  );

/**
 * A show-if: whether a block, a question or an option is shown (P71, show-if only). Like
 * `evaluateLogic`, except that a condition on a question without an answer is false, "does not equal"
 * included, so nothing shows and then disappears as the answer comes in. Only "is skipped" (and a
 * CTA's "is not clicked") holds for it, once the respondent has passed the question. Rules, start
 * logic and quotas keep `evaluateLogic`.
 *
 * @param notPassedElementIds The elements the respondent has not moved past yet: those of the page
 *   being shown.
 */
export const evaluateShowIf = (
  localSurvey: TJsWorkspaceStateSurvey,
  data: TResponseData,
  variablesData: TResponseVariables,
  conditions: TConditionGroup,
  selectedLanguage: string,
  embeddedValues: TResponseData,
  notPassedElementIds: ReadonlySet<string>
): boolean =>
  evaluateConditionGroup(
    conditions,
    (condition) =>
      evaluateUnansweredCondition(condition, data, (elementId) => !notPassedElementIds.has(elementId)) ??
      evaluateSingleCondition(localSurvey, data, variablesData, condition, selectedLanguage, embeddedValues)
  );

/**
 * What a Set value expression reads beyond answers and variables: the respondent's language (a
 * single-select answer yields its answer code) and the reserved-field map a `reserved` leaf reads.
 */
export interface TPerformActionsContext {
  selectedLanguage?: string;
  embeddedValues?: TResponseData;
}

export const performActions = (
  survey: TJsWorkspaceStateSurvey,
  actions: TSurveyBlockLogicAction[],
  data: TResponseData,
  calculationResults: TResponseVariables,
  context: TPerformActionsContext = {}
): {
  jumpTarget: string | undefined;
  requiredQuestionIds: string[];
  calculations: TResponseVariables;
  /** A Mark as low quality action ran (ENG-6933): the next response write carries the flag. */
  markLowQuality: boolean;
} => {
  let jumpTarget: string | undefined;
  const requiredQuestionIds: string[] = [];
  const calculations: TResponseVariables = { ...calculationResults };
  let markLowQuality = false;

  actions.forEach((action) => {
    switch (action.objective) {
      case "calculate": {
        const result = performCalculation(survey, action, data, calculations, context);
        if (result !== undefined) calculations[action.variableId] = result;
        break;
      }
      case "requireAnswer":
        requiredQuestionIds.push(action.target);
        break;
      case "jumpToBlock":
        if (!jumpTarget) {
          jumpTarget = action.target;
        }
        break;
      case "markLowQuality":
        markLowQuality = true;
        break;
    }
  });

  return { jumpTarget, requiredQuestionIds, calculations, markLowQuality };
};

const getLeftOperandValue = (
  localSurvey: TJsWorkspaceStateSurvey,
  data: TResponseData,
  variablesData: TResponseVariables,
  leftOperand: TSingleCondition["leftOperand"],
  selectedLanguage: string,
  embeddedValues: TResponseData
) => {
  switch (leftOperand.type) {
    case "element":
      const questions = getElementsFromSurveyBlocks(localSurvey.blocks);
      const currentQuestion = questions.find((q) => q.id === leftOperand.value);
      if (!currentQuestion) return undefined;

      const responseValue = data[leftOperand.value];

      if (currentQuestion.type === "openText" && currentQuestion.inputType === "number") {
        if (responseValue === undefined) return undefined;
        if (typeof responseValue === "string" && responseValue.trim() === "") return undefined;

        const numberValue = typeof responseValue === "number" ? responseValue : Number(responseValue);
        return isNaN(numberValue) ? undefined : numberValue;
      }

      if (currentQuestion.type === "multipleChoiceSingle" || currentQuestion.type === "multipleChoiceMulti") {
        const isOthersEnabled = currentQuestion.choices.some((c) => c.id === "other");

        if (typeof responseValue === "string") {
          const choice = findByLocalizedLabel(currentQuestion.choices, responseValue, selectedLanguage);

          if (!choice) {
            if (isOthersEnabled) {
              return "other";
            }

            return undefined;
          }

          return choice.id;
        } else if (Array.isArray(responseValue)) {
          let choices: string[] = [];
          responseValue.forEach((value) => {
            const foundChoice = findByLocalizedLabel(currentQuestion.choices, value, selectedLanguage);

            if (foundChoice) {
              choices.push(foundChoice.id);
            } else if (isOthersEnabled) {
              choices.push("other");
            }
          });
          if (choices) {
            return Array.from(new Set(choices));
          }
        }
      }

      // T21 (ENG-6937): a ranking stores the ranked labels in the respondent's language; conditions name
      // option ids, so "was ranked" maps each label back, as multi select does.
      if (currentQuestion.type === "ranking" && Array.isArray(responseValue)) {
        return responseValue.flatMap((value) => {
          const choice = findByLocalizedLabel(currentQuestion.choices, value, selectedLanguage);
          return choice ? [choice.id] : [];
        });
      }

      if (
        currentQuestion.type === "matrix" &&
        typeof responseValue === "object" &&
        !Array.isArray(responseValue)
      ) {
        if (isMatrixRowCondition(leftOperand.meta)) {
          // ENG-6934: the row id first, the position as the fallback; an unknown id is no row.
          const rowIndex = resolveMatrixRowIndex(currentQuestion, leftOperand.meta);
          if (rowIndex === undefined) return undefined;

          const row = findMatrixRowKey(currentQuestion.rows[rowIndex].label, responseValue, selectedLanguage);

          const rowValue = row === undefined ? undefined : responseValue[row];
          if (rowValue === "") return "";

          if (typeof rowValue === "string") {
            const column = findByLocalizedLabel(currentQuestion.columns, rowValue, selectedLanguage);
            if (!column) return undefined;
            return currentQuestion.columns.indexOf(column).toString();
          }
          return undefined;
        }
      }

      return data[leftOperand.value];
    case "variable":
      return getLogicVariableValue(getComputedEmbeddedFields(localSurvey), leftOperand.value, variablesData);
    case "hiddenField":
      return data[leftOperand.value];
    // Mid-survey the map holds client-available entries only, so a server-derived name
    // (country, durationSeconds, …) is absent here and reads as unset — never a fabricated 0 or "".
    case "reserved":
      return embeddedValues[leftOperand.value];
    default:
      return undefined;
  }
};

const getRightOperandValue = (
  localSurvey: TJsWorkspaceStateSurvey,
  data: TResponseData,
  variablesData: TResponseVariables,
  rightOperand: TSingleCondition["rightOperand"],
  embeddedValues: TResponseData
) => {
  if (!rightOperand) return undefined;

  switch (rightOperand.type) {
    case "element":
      return data[rightOperand.value];
    case "variable":
      return getLogicVariableValue(getComputedEmbeddedFields(localSurvey), rightOperand.value, variablesData);
    case "hiddenField":
      return data[rightOperand.value];
    case "reserved":
      return embeddedValues[rightOperand.value];
    case "static":
      return rightOperand.value;
    default:
      return undefined;
  }
};

/** The survey element an operand names, when it names one that exists. */
const findOperandElement = (
  elements: TSurveyElement[],
  operand: TSingleCondition["leftOperand"] | TSingleCondition["rightOperand"]
): TSurveyElement | undefined =>
  operand?.type === "element" ? elements.find((element) => element.id === operand.value) : undefined;

const evaluateSingleCondition = (
  localSurvey: TJsWorkspaceStateSurvey,
  data: TResponseData,
  variablesData: TResponseVariables,
  condition: TSingleCondition,
  selectedLanguage: string,
  embeddedValues: TResponseData
): boolean => {
  try {
    let leftValue = getLeftOperandValue(
      localSurvey,
      data,
      variablesData,
      condition.leftOperand,
      selectedLanguage,
      embeddedValues
    );
    let rightValue = condition.rightOperand
      ? getRightOperandValue(localSurvey, data, variablesData, condition.rightOperand, embeddedValues)
      : undefined;

    const questions = getElementsFromSurveyBlocks(localSurvey.blocks);
    const computedFields = getComputedEmbeddedFields(localSurvey);
    // Only element operands carry an element type; a `variable` operand's declared type is read
    // through `getComputedFieldDataType` instead, which tolerates a field the survey no longer declares.
    const leftElement = findOperandElement(questions, condition.leftOperand);
    const rightElement = findOperandElement(questions, condition.rightOperand);

    if (
      condition.leftOperand.type === "variable" &&
      getComputedFieldDataType(computedFields, condition.leftOperand.value) === "number" &&
      // `reserved` alongside `hiddenField` because both sides of the comparison are strings in their
      // stored form: a reserved value is projected as `string | number` and every number-typed entry
      // (`durationSeconds`, `viewportWidth`, `screenHeight`) therefore reached this comparison
      // unconverted, so a number variable measured against one could never match (ENG-2538). The
      // picker offers reserved right operands filtered by `dataType`, so this operand shape is
      // reachable from the editor.
      (condition.rightOperand?.type === "hiddenField" || condition.rightOperand?.type === "reserved")
    ) {
      rightValue = Number(rightValue as string);
    }

    // ENG-6934: a matrix row condition compares column positions; its column id(s) decide them.
    if (
      condition.leftOperand.type === "element" &&
      leftElement?.type === TSurveyElementTypeEnum.Matrix &&
      isMatrixRowCondition(condition.leftOperand.meta)
    ) {
      // A row or column id the matrix doesn't have never matches (P48), negated operators included.
      if (namesUnknownMatrixId(leftElement, condition.leftOperand.meta, condition.rightOperand)) return false;
      if (condition.rightOperand?.type === "static") {
        rightValue = resolveMatrixColumnValue(leftElement, condition.rightOperand);
      }
    }

    // ENG-6935: a date field (computed or ingested) holding a timestamp equals a picked day when it
    // falls on that day, as "is before" and "is after" read it; see `compareDateValues`.
    const embeddedFields = getSurveyEmbeddedFields(localSurvey);
    const onDateField =
      isDateFieldOperand(condition.leftOperand, embeddedFields) ||
      isDateFieldOperand(condition.rightOperand, embeddedFields);
    const dateOrder = onDateField ? compareDateValues(leftValue, rightValue) : undefined;

    return compareConditionValues(condition.operator, leftValue, rightValue, {
      leftElementType: leftElement?.type,
      rightElementType: rightElement?.type,
      dateOrder,
    });
  } catch (e) {
    return false;
  }
};

const performCalculation = (
  survey: TJsWorkspaceStateSurvey,
  action: TActionCalculate,
  data: TResponseData,
  calculations: Record<string, number | string>,
  context: TPerformActionsContext
): number | string | undefined => {
  const computedField = findComputedEmbeddedField(getComputedEmbeddedFields(survey), action.variableId);

  if (!computedField) return undefined;

  const { dataType } = computedField.field;

  // Set value (ENG-6935): the shared evaluator, "empty in, empty out". An empty result is written as
  // "" so it clears the field; the one-step operators below keep "empty counts as 0".
  if (action.value.type === "expression") {
    return evaluateSetValue(action.value.value, dataType, {
      survey,
      data,
      variables: calculations,
      reservedValues: context.embeddedValues,
      language: context.selectedLanguage ?? "default",
    });
  }

  let currentValue = calculations[action.variableId];
  if (currentValue === undefined) {
    currentValue = dataType === "number" ? 0 : "";
  }
  let operandValue: string | number | undefined;

  // Determine the operand value based on the action.value type
  switch (action.value.type) {
    case "static":
      operandValue = action.value.value;
      break;
    case "variable":
      const value = calculations[action.value.value];
      if (typeof value === "number" || typeof value === "string") {
        operandValue = value;
      }
      break;
    // Deliberately no `default` arm: a legacy `"question"` operand (admitted at the type level by
    // ZDynamicLogicFieldValueDeprecated, normalized away at the API boundary) stays unresolved and
    // the calculation returns undefined, exactly as before.
    case "element":
    case "hiddenField":
      const val = data[action.value.value];
      if (typeof val === "number" || typeof val === "string") {
        if (dataType === "number" && !Number.isNaN(Number(val))) {
          operandValue = Number(val);
        }
        operandValue = val;
      }
      break;
  }

  if (operandValue === undefined || operandValue === null) return undefined;

  let result: number | string;

  switch (action.operator) {
    case "add":
      result = Number(currentValue) + Number(operandValue);
      break;
    case "subtract":
      result = Number(currentValue) - Number(operandValue);
      break;
    case "multiply":
      result = Number(currentValue) * Number(operandValue);
      break;
    case "divide":
      if (Number(operandValue) === 0) return undefined;
      result = Number(currentValue) / Number(operandValue);
      break;
    case "assign":
      result = operandValue;
      break;
    case "concat":
      result = String(currentValue) + String(operandValue);
      break;
  }

  return result;
};
