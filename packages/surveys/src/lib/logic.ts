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
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import {
  compareDateValues,
  isDateAfter,
  isDateBefore,
  isDateFieldOperand,
} from "@formbricks/types/surveys/date-comparison";
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

/** Whether the left operand is a date element and both sides are strings. */
const isDateElementComparison = ({
  condition,
  leftField,
  leftValue,
  rightValue,
}: TConditionValues): boolean =>
  condition.leftOperand.type === "element" &&
  (leftField as TSurveyElement).type === TSurveyElementTypeEnum.Date &&
  typeof leftValue === "string" &&
  typeof rightValue === "string";

const isSameTime = (left: unknown, right: unknown): boolean =>
  new Date(left as string).getTime() === new Date(right as string).getTime();

/**
 * When left value is of openText, hiddenField, variable and right value is of multichoice (or a
 * date): whether the two are equal (`!== negate`), or `undefined` when the right element is neither.
 */
const compareWithRightElement = (
  { condition, rightField, leftValue, rightValue }: TConditionValues,
  negate: boolean
): boolean | undefined => {
  if (condition.rightOperand?.type !== "element") return undefined;
  const rightType = (rightField as TSurveyElement).type;
  if (rightType === TSurveyElementTypeEnum.MultipleChoiceMulti) {
    if (Array.isArray(rightValue) && typeof leftValue === "string" && rightValue.length === 1) {
      return rightValue.includes(leftValue) !== negate;
    }
    return false;
  }
  if (
    rightType === TSurveyElementTypeEnum.Date &&
    typeof leftValue === "string" &&
    typeof rightValue === "string"
  ) {
    return isSameTime(leftValue, rightValue) !== negate;
  }
  return undefined;
};

const evaluateEquals = (values: TConditionValues): boolean => {
  const { dateOrder, leftValue, rightValue } = values;
  if (dateOrder !== undefined) return dateOrder === 0;
  // when left value is of date question and right value is string
  if (isDateElementComparison(values)) return isSameTime(leftValue, rightValue);

  const rightElementResult = compareWithRightElement(values, false);
  if (rightElementResult !== undefined) return rightElementResult;

  return (
    (Array.isArray(leftValue) &&
      leftValue.length === 1 &&
      typeof rightValue === "string" &&
      leftValue.includes(rightValue)) ||
    leftValue === rightValue
  );
};

const evaluateDoesNotEqual = (values: TConditionValues): boolean => {
  const { condition, dateOrder, leftField, leftValue, rightValue } = values;
  if (dateOrder !== undefined) return dateOrder !== 0;
  // when left value is of picture selection question and right value is its option
  if (
    condition.leftOperand.type === "element" &&
    (leftField as TSurveyElement).type === TSurveyElementTypeEnum.PictureSelection &&
    Array.isArray(leftValue) &&
    leftValue.length > 0 &&
    typeof rightValue === "string"
  ) {
    return !leftValue.includes(rightValue);
  }

  // when left value is of date question and right value is string
  if (isDateElementComparison(values)) return !isSameTime(leftValue, rightValue);

  const rightElementResult = compareWithRightElement(values, true);
  if (rightElementResult !== undefined) return rightElementResult;

  // decide inside the guard: OR-ing past it would fall through to `leftValue !== rightValue`,
  // which is always true for an array vs. a string (a matching single selection included)
  if (Array.isArray(leftValue) && leftValue.length === 1 && typeof rightValue === "string") {
    return !leftValue.includes(rightValue);
  }

  return leftValue !== rightValue;
};

const evaluateIsSubmitted = ({ condition, leftField, leftValue }: TConditionValues): boolean => {
  if (typeof leftValue === "string") {
    if (
      condition.leftOperand.type === "element" &&
      (leftField as TSurveyElement).type === TSurveyElementTypeEnum.FileUpload &&
      leftValue
    ) {
      return leftValue !== "skipped";
    }
    return leftValue !== "" && leftValue !== null;
  } else if (Array.isArray(leftValue)) {
    return leftValue.length > 0;
  } else if (typeof leftValue === "number") {
    return leftValue !== null;
  }
  return false;
};

const evaluateIsSkipped = ({ leftValue }: TConditionValues): boolean =>
  (Array.isArray(leftValue) && leftValue.length === 0) ||
  leftValue === "" ||
  leftValue === null ||
  leftValue === undefined ||
  (typeof leftValue === "object" && Object.entries(leftValue).length === 0);

/** Both sides are lists, and `test` holds of the right list against the left one. */
const compareLists =
  (test: (left: unknown[], right: unknown[]) => boolean) =>
  ({ leftValue, rightValue }: TConditionValues): boolean =>
    Array.isArray(leftValue) && Array.isArray(rightValue) && test(leftValue, rightValue);

const isSet = ({ leftValue }: TConditionValues): boolean =>
  leftValue !== undefined && leftValue !== null && leftValue !== "";

/** How each operator compares a condition's resolved operands. An operator not listed is false. */
const OPERATOR_EVALUATORS: Partial<
  Record<TSingleCondition["operator"], (values: TConditionValues) => boolean>
> = {
  equals: evaluateEquals,
  doesNotEqual: evaluateDoesNotEqual,
  contains: ({ leftValue, rightValue }) => String(leftValue).includes(String(rightValue)),
  doesNotContain: ({ leftValue, rightValue }) => !String(leftValue).includes(String(rightValue)),
  startsWith: ({ leftValue, rightValue }) => String(leftValue).startsWith(String(rightValue)),
  doesNotStartWith: ({ leftValue, rightValue }) => !String(leftValue).startsWith(String(rightValue)),
  endsWith: ({ leftValue, rightValue }) => String(leftValue).endsWith(String(rightValue)),
  doesNotEndWith: ({ leftValue, rightValue }) => !String(leftValue).endsWith(String(rightValue)),
  isSubmitted: evaluateIsSubmitted,
  isSkipped: evaluateIsSkipped,
  isGreaterThan: ({ leftValue, rightValue }) => Number(leftValue) > Number(rightValue),
  isLessThan: ({ leftValue, rightValue }) => Number(leftValue) < Number(rightValue),
  isGreaterThanOrEqual: ({ leftValue, rightValue }) => Number(leftValue) >= Number(rightValue),
  isLessThanOrEqual: ({ leftValue, rightValue }) => Number(leftValue) <= Number(rightValue),
  equalsOneOf: ({ leftValue, rightValue }) =>
    Array.isArray(rightValue) && typeof leftValue === "string" && rightValue.includes(leftValue),
  includesAllOf: compareLists((left, right) => right.every((v) => left.includes(v))),
  includesOneOf: compareLists((left, right) => right.some((v) => left.includes(v))),
  doesNotIncludeAllOf: compareLists((left, right) => !right.every((v) => left.includes(v))),
  doesNotIncludeOneOf: compareLists((left, right) => !right.some((v) => left.includes(v))),
  isAccepted: ({ leftValue }) => leftValue === "accepted",
  isClicked: ({ leftValue }) => leftValue === "clicked",
  isNotClicked: ({ leftValue }) => leftValue !== "clicked",
  isAfter: ({ leftValue, rightValue }) => isDateAfter(leftValue, rightValue),
  isBefore: ({ leftValue, rightValue }) => isDateBefore(leftValue, rightValue),
  isBooked: ({ leftValue }) => leftValue === "booked" || !!(leftValue && leftValue !== ""),
  isPartiallySubmitted: ({ leftValue }) =>
    typeof leftValue === "object" && Object.values(leftValue as object).includes(""),
  isCompletelySubmitted: ({ leftValue }) => {
    if (typeof leftValue !== "object") return false;
    const values: unknown[] = Object.values(leftValue as object);
    return values.length > 0 && !values.includes("");
  },
  isSet,
  isNotEmpty: isSet,
  isNotSet: ({ leftValue }) => leftValue === undefined || leftValue === null || leftValue === "",
  isEmpty: ({ leftValue }) => leftValue === "",
  isAnyOf: ({ leftValue, rightValue }) =>
    Array.isArray(rightValue) && typeof leftValue === "string" && rightValue.includes(leftValue),
};

/** The evaluator of a known operator; an unknown one (a prototype key included) has none, so it is false. */
const getOperatorEvaluator = (operator: string): ((values: TConditionValues) => boolean) | undefined =>
  Object.hasOwn(OPERATOR_EVALUATORS, operator)
    ? OPERATOR_EVALUATORS[operator as TSingleCondition["operator"]]
    : undefined;

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
    return getOperatorEvaluator(condition.operator)?.(values) ?? false;
  } catch {
    return false;
  }
};

/** A variable's value, or the one-step operators' starting value when it has none yet. */
const withDefaultValue = (value: number | string | undefined, dataType: string): number | string =>
  value ?? (dataType === "number" ? 0 : "");

/**
 * Whether an answer or hidden field reads as a number. Blank text is not one: `Number("")` is 0, which
 * would turn an empty field into a real 0 and stop an `isSkipped` condition from seeing it.
 */
const isNumericOperand = (val: string | number): boolean =>
  typeof val === "number" || (val.trim() !== "" && !Number.isNaN(Number(val)));

/** The value a one-step calculation applies: a static value, a variable, or an answer. */
const getCalculationOperand = (
  action: TActionCalculate,
  data: TResponseData,
  calculations: Record<string, number | string>,
  dataType: string
): string | number | undefined => {
  let operandValue: string | number | undefined;

  // Determine the operand value based on the action.value type
  switch (action.value.type) {
    case "static":
      operandValue = action.value.value;
      break;
    case "variable": {
      const value = calculations[action.value.value];
      if (typeof value === "number" || typeof value === "string") {
        operandValue = value;
      }
      break;
    }
    // Deliberately no `default` arm: a legacy `"question"` operand (admitted at the type level by
    // ZDynamicLogicFieldValueDeprecated, normalized away at the API boundary) stays unresolved and
    // the calculation returns undefined, exactly as before.
    case "element":
    case "hiddenField": {
      const val = data[action.value.value];
      if (typeof val === "number" || typeof val === "string") {
        // A number field takes a numeric answer or hidden field as a number; anything else, blank
        // included, keeps its text. Same rule as the server evaluator (apps/web/lib/surveyLogic/utils.ts).
        operandValue = dataType === "number" && isNumericOperand(val) ? Number(val) : val;
      }
      break;
    }
  }
  return operandValue;
};

/** Applies a one-step operator; `undefined` for a division by zero. */
const applyCalculationOperator = (
  operator: TActionCalculate["operator"],
  currentValue: number | string,
  operandValue: number | string
): number | string | undefined => {
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

  const currentValue = withDefaultValue(calculations[action.variableId], dataType);

  const operandValue = getCalculationOperand(action, data, calculations, dataType);
  if (operandValue === undefined || operandValue === null) return undefined;

  return applyCalculationOperator(action.operator, currentValue, operandValue);
};
