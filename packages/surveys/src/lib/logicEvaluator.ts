import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { isConditionsGroup } from "@formbricks/lib/survey/logic/utils";
import { TResponseData, TResponseVariables } from "@formbricks/types/responses";
import {
  TAction,
  TActionCalculate,
  TConditionGroup,
  TSingleCondition,
} from "@formbricks/types/surveys/logic";
import { TSurvey } from "@formbricks/types/surveys/types";

export const evaluateAdvancedLogic = (
  localSurvey: TSurvey,
  data: TResponseData,
  conditions: TConditionGroup,
  selectedLanguage: string
): boolean => {
  const evaluateConditionGroup = (group: TConditionGroup): boolean => {
    const results = group.conditions.map((condition) => {
      if (isConditionsGroup(condition)) {
        return evaluateConditionGroup(condition);
      } else {
        return evaluateSingleCondition(localSurvey, data, condition, selectedLanguage);
      }
    });

    return group.connector === "or" ? results.some((r) => r) : results.every((r) => r);
  };

  return evaluateConditionGroup(conditions);
};

const evaluateSingleCondition = (
  localSurvey: TSurvey,
  data: TResponseData,
  condition: TSingleCondition,
  selectedLanguage: string
): boolean => {
  const leftValue = getLeftOperandValue(localSurvey, data, condition.leftOperand, selectedLanguage);
  const rightValue = condition.rightOperand
    ? getRightOperandValue(localSurvey, condition.rightOperand, data)
    : undefined;

  switch (condition.operator) {
    case "equals":
      return (
        (Array.isArray(leftValue) &&
          leftValue.length === 1 &&
          typeof rightValue === "string" &&
          leftValue.includes(rightValue)) ||
        leftValue?.toString() === rightValue
      );
    case "doesNotEqual":
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
        Array.isArray(leftValue) && Array.isArray(rightValue) && rightValue.some((v) => leftValue.includes(v))
      );
    case "isAccepted":
      return leftValue === "accepted";
    case "isClicked":
      return leftValue === "clicked";
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
    default:
      return false;
  }
};

const getLeftOperandValue = (
  localSurvey: TSurvey,
  data: TResponseData,
  leftOperand: TSingleCondition["leftOperand"],
  selectedLanguage: string
) => {
  switch (leftOperand.type) {
    case "question":
      const currentQuestion = localSurvey.questions.find((q) => q.id === leftOperand.id);
      if (!currentQuestion) return undefined;

      const responseValue = data[leftOperand.id];

      if (currentQuestion.type === "multipleChoiceSingle" || currentQuestion.type === "multipleChoiceMulti") {
        let choice;

        if (typeof responseValue === "string") {
          choice = currentQuestion.choices.find((choice) => {
            return getLocalizedValue(choice.label, selectedLanguage) === responseValue;
          });

          if (!choice) return undefined;

          return choice.id;
        } else if (Array.isArray(responseValue)) {
          choice = currentQuestion.choices
            .filter((choice) => {
              return responseValue.includes(getLocalizedValue(choice.label, selectedLanguage));
            })
            .map((choice) => choice.id);
        }

        if (choice) {
          return choice;
        }
      }
      return data[leftOperand.id];
    case "variable":
      const variables = localSurvey.variables || [];
      const variable = variables.find((v) => v.id === leftOperand.id);

      if (!variable) return undefined;

      const variableValue = data[leftOperand.id];

      if (variable.type === "number") return Number(variableValue) || 0;
      return variableValue || "";
    case "hiddenField":
      return data[leftOperand.id];
    default:
      return undefined;
  }
};

const getRightOperandValue = (
  localSurvey: TSurvey,
  rightOperand: TSingleCondition["rightOperand"],
  data: TResponseData
) => {
  if (!rightOperand) return undefined;

  switch (rightOperand.type) {
    case "question":
      return data[rightOperand.value];
    case "choice":
      return rightOperand.value;
    case "variable":
      const variables = localSurvey.variables || [];
      const variable = variables.find((v) => v.id === rightOperand.value);

      if (!variable) return undefined;

      const variableValue = data[rightOperand.value];

      if (variable.type === "number") return Number(variableValue) || 0;
      return variableValue || "";
    case "hiddenField":
      return data[rightOperand.value];
    case "static":
      return rightOperand.value;
    default:
      return undefined;
  }
};

export const performActions = (
  survey: TSurvey,
  actions: TAction[],
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
      case "jumpToQuestion":
        if (!jumpTarget) {
          jumpTarget = action.target;
        }
        break;
    }
  });

  return { jumpTarget, requiredQuestionIds, calculations };
};

const performCalculation = (
  survey: TSurvey,
  action: TActionCalculate,
  data: TResponseData,
  calculations: Record<string, number | string>
): number | string | undefined => {
  const variables = survey.variables || [];
  const variable = variables.find((v) => v.id === action.variableId);

  if (!variable) return undefined;

  let currentValue = calculations[action.variableId];
  if (currentValue === undefined) {
    currentValue = variable.type === "number" ? 0 : "";
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
    case "question":
    case "hiddenField":
      const val = data[action.value.value];
      if (typeof val === "number" || typeof val === "string") {
        if (variable.type === "number" && !isNaN(Number(val))) {
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
