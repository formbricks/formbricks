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
import { evaluateBooleanAssign } from "@formbricks/types/surveys/boolean-assign";
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
import { getOneStepOperand } from "@formbricks/types/surveys/one-step-operand";
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
        // eslint-disable-next-line typescript/prefer-nullish-coalescing -- an empty jump target means no jump
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

type TElementOperand = Extract<TSingleCondition["leftOperand"], { type: "element" }>;
type TChoiceElement = Extract<TSurveyElement, { type: "multipleChoiceSingle" | "multipleChoiceMulti" }>;
type TMatrixElement = Extract<TSurveyElement, { type: "matrix" }>;

/** An open text number answer as a number; blank or non-numeric answers read as unset. */
const getNumberAnswerValue = (responseValue: TResponseData[string] | undefined) => {
  if (responseValue === undefined) return undefined;
  if (typeof responseValue === "string" && responseValue.trim() === "") return undefined;

  const numberValue = typeof responseValue === "number" ? responseValue : Number(responseValue);
  return isNaN(numberValue) ? undefined : numberValue;
};

/** A choice answer as option ids: a label without an option reads as "other" when it is on. */
const getChoiceAnswerValue = (
  currentQuestion: TChoiceElement,
  responseValue: TResponseData[string] | undefined,
  selectedLanguage: string
) => {
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
    const choices: string[] = [];
    responseValue.forEach((value) => {
      const foundChoice = findByLocalizedLabel(currentQuestion.choices, value, selectedLanguage);

      if (foundChoice) {
        choices.push(foundChoice.id);
      } else if (isOthersEnabled) {
        choices.push("other");
      }
    });
    return Array.from(new Set(choices));
  }

  return responseValue;
};

/** A matrix row condition's answer: the position of the column picked in that row. */
const getMatrixRowAnswerValue = (
  currentQuestion: TMatrixElement,
  meta: TElementOperand["meta"],
  responseValue: Record<string, string>,
  selectedLanguage: string
) => {
  // ENG-6934: the row id first, the position as the fallback; an unknown id is no row.
  const rowIndex = resolveMatrixRowIndex(currentQuestion, meta);
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
};

/** An element operand's answer, in the form conditions compare: numbers, option ids, column positions. */
const getElementOperandValue = (
  localSurvey: TJsWorkspaceStateSurvey,
  data: TResponseData,
  leftOperand: TElementOperand,
  selectedLanguage: string
) => {
  const questions = getElementsFromSurveyBlocks(localSurvey.blocks);
  const currentQuestion = questions.find((q) => q.id === leftOperand.value);
  if (!currentQuestion) return undefined;

  const responseValue = data[leftOperand.value];

  if (currentQuestion.type === "openText" && currentQuestion.inputType === "number") {
    return getNumberAnswerValue(responseValue);
  }

  if (currentQuestion.type === "multipleChoiceSingle" || currentQuestion.type === "multipleChoiceMulti") {
    return getChoiceAnswerValue(currentQuestion, responseValue, selectedLanguage);
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
    !Array.isArray(responseValue) &&
    isMatrixRowCondition(leftOperand.meta)
  ) {
    return getMatrixRowAnswerValue(currentQuestion, leftOperand.meta, responseValue, selectedLanguage);
  }

  return data[leftOperand.value];
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
      return getElementOperandValue(localSurvey, data, leftOperand, selectedLanguage);
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

/**
 * One condition's operands, resolved for comparison. Only element and hiddenField operands get a
 * field; a `variable` operand's declared type is read through `getComputedFieldDataType` instead,
 * which tolerates a condition naming a field the survey no longer declares.
 */
interface TConditionValues {
  condition: TSingleCondition;
  leftValue: unknown;
  rightValue: unknown;
  leftField: TSurveyElement | string;
  rightField: TSurveyElement | string;
  /** How a date field operand orders against the other side, when one side is a date field. */
  dateOrder: number | undefined;
}

/** The element an element operand names (or "" when it is gone), the id of a hidden field, else "". */
const getOperandField = (
  questions: TSurveyElement[],
  operand: TSingleCondition["leftOperand"] | TSingleCondition["rightOperand"]
): TSurveyElement | string => {
  if (operand?.type === "element") return questions.find((q) => q.id === operand.value) ?? "";
  if (operand?.type === "hiddenField") return operand.value;
  return "";
};

/**
 * Resolves a condition's operands for comparison, or `undefined` when it can never match: a matrix
 * row condition naming a row or column id the matrix doesn't have (P48), negated operators included.
 */
const resolveConditionValues = (
  localSurvey: TJsWorkspaceStateSurvey,
  data: TResponseData,
  variablesData: TResponseVariables,
  condition: TSingleCondition,
  selectedLanguage: string,
  embeddedValues: TResponseData
): TConditionValues | undefined => {
  const leftValue = getLeftOperandValue(
    localSurvey,
    data,
    variablesData,
    condition.leftOperand,
    selectedLanguage,
    embeddedValues
  );
  let rightValue: unknown = condition.rightOperand
    ? getRightOperandValue(localSurvey, data, variablesData, condition.rightOperand, embeddedValues)
    : undefined;

  const questions = getElementsFromSurveyBlocks(localSurvey.blocks);
  const computedFields = getComputedEmbeddedFields(localSurvey);
  const leftField = getOperandField(questions, condition.leftOperand);
  const rightField = getOperandField(questions, condition.rightOperand);

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
    rightValue = Number(rightValue);
  }

  // ENG-6934: a matrix row condition compares column positions; its column id(s) decide them.
  if (
    condition.leftOperand.type === "element" &&
    typeof leftField === "object" &&
    leftField.type === TSurveyElementTypeEnum.Matrix &&
    isMatrixRowCondition(condition.leftOperand.meta)
  ) {
    if (namesUnknownMatrixId(leftField, condition.leftOperand.meta, condition.rightOperand)) return undefined;
    if (condition.rightOperand?.type === "static") {
      rightValue = resolveMatrixColumnValue(leftField, condition.rightOperand);
    }
  }

  // ENG-6935: a date field (computed or ingested) holding a timestamp equals a picked day when it
  // falls on that day, as "is before" and "is after" read it; see `compareDateValues`.
  const embeddedFields = getSurveyEmbeddedFields(localSurvey);
  const onDateField =
    isDateFieldOperand(condition.leftOperand, embeddedFields) ||
    isDateFieldOperand(condition.rightOperand, embeddedFields);
  const dateOrder = onDateField ? compareDateValues(leftValue, rightValue) : undefined;

  return { condition, leftValue, rightValue, leftField, rightField, dateOrder };
};

const evaluateSingleCondition = (
  localSurvey: TJsWorkspaceStateSurvey,
  data: TResponseData,
  variablesData: TResponseVariables,
  condition: TSingleCondition,
  selectedLanguage: string,
  embeddedValues: TResponseData
): boolean => {
  try {
    const values = resolveConditionValues(
      localSurvey,
      data,
      variablesData,
      condition,
      selectedLanguage,
      embeddedValues
    );
    if (!values) return false;
    // ADR 0046: the comparison survey logic and workflow conditions share.
    return compareConditionValues(condition.operator, values.leftValue, values.rightValue, {
      leftElementType: typeof values.leftField === "object" ? values.leftField.type : undefined,
      rightElementType: typeof values.rightField === "object" ? values.rightField.type : undefined,
      dateOrder: values.dateOrder,
    });
  } catch {
    return false;
  }
};

/** A value the one-step operators read or write. */
type TCalculationValue = number | string;

/**
 * A variable's value, or the one-step operators' starting value when it has none yet. A stored
 * true/false is not a number, so a number field starts from 0 rather than `Number("true")` (NaN).
 */
const withDefaultValue = (
  value: TResponseVariables[string] | undefined,
  dataType: string
): TCalculationValue => {
  if (typeof value === "boolean") return dataType === "number" ? 0 : String(value);
  return value ?? (dataType === "number" ? 0 : "");
};

/** Applies a one-step operator; `undefined` for a division by zero. */
const applyCalculationOperator = (
  operator: TActionCalculate["operator"],
  currentValue: TCalculationValue,
  operandValue: TCalculationValue
): TCalculationValue | undefined => {
  switch (operator) {
    case "add":
      return Number(currentValue) + Number(operandValue);
    case "subtract":
      return Number(currentValue) - Number(operandValue);
    case "multiply":
      return Number(currentValue) * Number(operandValue);
    case "divide":
      if (Number(operandValue) === 0) return undefined;
      return Number(currentValue) / Number(operandValue);
    case "assign":
      return operandValue;
    case "concat":
      return String(currentValue) + String(operandValue);
  }
};

const performCalculation = (
  survey: TJsWorkspaceStateSurvey,
  action: TActionCalculate,
  data: TResponseData,
  calculations: TResponseVariables,
  context: TPerformActionsContext
): TResponseVariables[string] | undefined => {
  const computedField = findComputedEmbeddedField(getComputedEmbeddedFields(survey), action.variableId);

  if (!computedField) return undefined;

  const { dataType } = computedField.field;

  // ENG-6973: a true/false field is assigned True, False or another true/false field, as a real boolean.
  if (dataType === "boolean") return evaluateBooleanAssign(action, data, calculations);

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

  const currentValue = withDefaultValue(calculations[action.variableId], dataType);
  const operandValue = getOneStepOperand(action.value, {
    data,
    variables: calculations,
    reservedValues: context.embeddedValues,
    dataType,
  });
  if (operandValue === undefined || operandValue === null) return undefined;

  return applyCalculationOperator(action.operator, currentValue, operandValue);
};
