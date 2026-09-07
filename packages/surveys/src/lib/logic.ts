import {
  findComputedEmbeddedField,
  getComputedEmbeddedFields,
  getComputedFieldDataType,
  getLogicVariableValue,
} from "@formbricks/types/embedded-data-resolver";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TResponseData, type TResponseVariables } from "@formbricks/types/responses";
import { type TActionCalculate, type TSurveyBlockLogicAction } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import { type TConditionGroup, type TSingleCondition } from "@formbricks/types/surveys/logic";
import { evaluateConditionGroup } from "@formbricks/types/surveys/logic-evaluation";
import { getLocalizedValue } from "@/lib/i18n";
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

export const performActions = (
  survey: TJsWorkspaceStateSurvey,
  actions: TSurveyBlockLogicAction[],
  data: TResponseData,
  calculationResults: TResponseVariables
): {
  jumpTarget: string | undefined;
  requiredQuestionIds: string[];
  calculations: TResponseVariables;
} => {
  let jumpTarget: string | undefined;
  const requiredQuestionIds: string[] = [];
  const calculations: TResponseVariables = { ...calculationResults };

  actions.forEach((action) => {
    switch (action.objective) {
      case "calculate":
        const result = performCalculation(survey, action, data, calculations);
        if (result !== undefined) calculations[action.variableId] = result;
        break;
      case "requireAnswer":
        requiredQuestionIds.push(action.target);
        break;
      case "jumpToBlock":
        if (!jumpTarget) {
          jumpTarget = action.target;
        }
        break;
    }
  });

  return { jumpTarget, requiredQuestionIds, calculations };
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
          const choice = currentQuestion.choices.find((choice) => {
            return getLocalizedValue(choice.label, selectedLanguage) === responseValue;
          });

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
            const foundChoice = currentQuestion.choices.find((choice) => {
              return getLocalizedValue(choice.label, selectedLanguage) === value;
            });

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

      if (
        currentQuestion.type === "matrix" &&
        typeof responseValue === "object" &&
        !Array.isArray(responseValue)
      ) {
        if (leftOperand.meta && leftOperand.meta?.row !== undefined) {
          const rowIndex = Number(leftOperand.meta.row);

          if (isNaN(rowIndex) || rowIndex < 0 || rowIndex >= currentQuestion.rows.length) {
            return undefined;
          }

          const row = getLocalizedValue(currentQuestion.rows[rowIndex].label, selectedLanguage);

          const rowValue = responseValue[row];
          if (rowValue === "") return "";

          if (rowValue) {
            const columnIndex = currentQuestion.columns.findIndex((column) => {
              return getLocalizedValue(column.label, selectedLanguage) === rowValue;
            });

            if (columnIndex === -1) return undefined;
            return columnIndex.toString();
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

    // Only element and hiddenField operands are inspected below; a `variable` operand's declared
    // type is read through `getComputedFieldDataType` instead, which tolerates a condition naming a
    // field the survey no longer declares.
    let leftField: TSurveyElement | string;

    const questions = getElementsFromSurveyBlocks(localSurvey.blocks);
    const computedFields = getComputedEmbeddedFields(localSurvey);
    if (condition.leftOperand?.type === "element") {
      leftField = questions.find((q) => q.id === condition.leftOperand?.value) ?? "";
    } else if (condition.leftOperand?.type === "hiddenField") {
      leftField = condition.leftOperand.value as string;
    } else {
      leftField = "";
    }

    let rightField: TSurveyElement | string;

    if (condition.rightOperand?.type === "element") {
      rightField = questions.find((q) => q.id === condition.rightOperand?.value) ?? "";
    } else if (condition.rightOperand?.type === "hiddenField") {
      rightField = condition.rightOperand.value as string;
    } else {
      rightField = "";
    }

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

    switch (condition.operator) {
      case "equals":
        if (condition.leftOperand.type === "element") {
          if (
            (leftField as TSurveyElement).type === TSurveyElementTypeEnum.Date &&
            typeof leftValue === "string" &&
            typeof rightValue === "string"
          ) {
            // when left value is of date question and right value is string
            return new Date(leftValue).getTime() === new Date(rightValue).getTime();
          }
        }

        // when left value is of openText, hiddenField, variable and right value is of multichoice
        if (condition.rightOperand?.type === "element") {
          if ((rightField as TSurveyElement).type === TSurveyElementTypeEnum.MultipleChoiceMulti) {
            if (Array.isArray(rightValue) && typeof leftValue === "string" && rightValue.length === 1) {
              return rightValue.includes(leftValue as string);
            } else return false;
          } else if (
            (rightField as TSurveyElement).type === TSurveyElementTypeEnum.Date &&
            typeof leftValue === "string" &&
            typeof rightValue === "string"
          ) {
            return new Date(leftValue).getTime() === new Date(rightValue).getTime();
          }
        }

        return (
          (Array.isArray(leftValue) &&
            leftValue.length === 1 &&
            typeof rightValue === "string" &&
            leftValue.includes(rightValue)) ||
          leftValue === rightValue
        );
      case "doesNotEqual":
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
        if (
          condition.leftOperand.type === "element" &&
          (leftField as TSurveyElement).type === TSurveyElementTypeEnum.Date &&
          typeof leftValue === "string" &&
          typeof rightValue === "string"
        ) {
          return new Date(leftValue).getTime() !== new Date(rightValue).getTime();
        }

        // when left value is of openText, hiddenField, variable and right value is of multichoice
        if (condition.rightOperand?.type === "element") {
          if ((rightField as TSurveyElement).type === TSurveyElementTypeEnum.MultipleChoiceMulti) {
            if (Array.isArray(rightValue) && typeof leftValue === "string" && rightValue.length === 1) {
              return !rightValue.includes(leftValue as string);
            } else return false;
          } else if (
            (rightField as TSurveyElement).type === TSurveyElementTypeEnum.Date &&
            typeof leftValue === "string" &&
            typeof rightValue === "string"
          ) {
            return new Date(leftValue).getTime() !== new Date(rightValue).getTime();
          }
        }

        // decide inside the guard: OR-ing past it would fall through to `leftValue !== rightValue`,
        // which is always true for an array vs. a string (a matching single selection included)
        if (Array.isArray(leftValue) && leftValue.length === 1 && typeof rightValue === "string") {
          return !leftValue.includes(rightValue);
        }

        return leftValue !== rightValue;
      case "contains":
        return String(leftValue).includes(String(rightValue));
      case "doesNotContain":
        return !String(leftValue).includes(String(rightValue));
      case "startsWith":
        return String(leftValue).startsWith(String(rightValue));
      case "doesNotStartWith":
        return !String(leftValue).startsWith(String(rightValue));
      case "endsWith":
        return String(leftValue).endsWith(String(rightValue));
      case "doesNotEndWith":
        return !String(leftValue).endsWith(String(rightValue));
      case "isSubmitted":
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
      case "isSkipped":
        return (
          (Array.isArray(leftValue) && leftValue.length === 0) ||
          leftValue === "" ||
          leftValue === null ||
          leftValue === undefined ||
          (typeof leftValue === "object" && Object.entries(leftValue).length === 0)
        );
      case "isGreaterThan":
        return Number(leftValue) > Number(rightValue);
      case "isLessThan":
        return Number(leftValue) < Number(rightValue);
      case "isGreaterThanOrEqual":
        return Number(leftValue) >= Number(rightValue);
      case "isLessThanOrEqual":
        return Number(leftValue) <= Number(rightValue);
      case "equalsOneOf":
        return Array.isArray(rightValue) && typeof leftValue === "string" && rightValue.includes(leftValue);
      case "includesAllOf":
        return (
          Array.isArray(leftValue) &&
          Array.isArray(rightValue) &&
          rightValue.every((v) => leftValue.includes(v))
        );
      case "includesOneOf":
        return (
          Array.isArray(leftValue) &&
          Array.isArray(rightValue) &&
          rightValue.some((v) => leftValue.includes(v))
        );
      case "doesNotIncludeAllOf":
        return (
          Array.isArray(leftValue) &&
          Array.isArray(rightValue) &&
          rightValue.every((v) => !leftValue.includes(v))
        );
      case "doesNotIncludeOneOf":
        return (
          Array.isArray(leftValue) &&
          Array.isArray(rightValue) &&
          !rightValue.some((v) => leftValue.includes(v))
        );
      case "isAccepted":
        return leftValue === "accepted";
      case "isClicked":
        return leftValue === "clicked";
      case "isNotClicked":
        return leftValue !== "clicked";
      case "isAfter":
        return new Date(String(leftValue)) > new Date(String(rightValue));
      case "isBefore":
        return new Date(String(leftValue)) < new Date(String(rightValue));
      case "isBooked":
        return leftValue === "booked" || !!(leftValue && leftValue !== "");
      case "isPartiallySubmitted":
        if (typeof leftValue === "object") {
          return Object.values(leftValue).includes("");
        } else return false;
      case "isCompletelySubmitted":
        if (typeof leftValue === "object") {
          const values = Object.values(leftValue);
          return values.length > 0 && !values.includes("");
        } else return false;
      case "isSet":
      case "isNotEmpty":
        return leftValue !== undefined && leftValue !== null && leftValue !== "";
      case "isNotSet":
        return leftValue === undefined || leftValue === null || leftValue === "";
      case "isEmpty":
        return leftValue === "";
      case "isAnyOf":
        if (Array.isArray(rightValue) && typeof leftValue === "string") {
          return rightValue.includes(leftValue);
        }
        return false;
      default:
        return false;
    }
  } catch (e) {
    return false;
  }
};

const performCalculation = (
  survey: TJsWorkspaceStateSurvey,
  action: TActionCalculate,
  data: TResponseData,
  calculations: Record<string, number | string>
): number | string | undefined => {
  const computedField = findComputedEmbeddedField(getComputedEmbeddedFields(survey), action.variableId);

  if (!computedField) return undefined;

  const { dataType } = computedField.field;

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
