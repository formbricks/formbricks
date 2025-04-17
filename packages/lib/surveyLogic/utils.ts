import { createId } from "@paralleldrive/cuid2";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TResponseData, TResponseVariables } from "@formbricks/types/responses";
import {
  TActionCalculate,
  TActionObjective,
  TConditionGroup,
  TSingleCondition,
  TSurveyLogic,
  TSurveyLogicAction,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
  TSurveyVariable,
} from "@formbricks/types/surveys/types";
import { getLocalizedValue } from "../i18n/utils";

type TCondition = TSingleCondition | TConditionGroup;

export const isConditionGroup = (condition: TCondition): condition is TConditionGroup => {
  return (condition as TConditionGroup).connector !== undefined;
};

export const duplicateLogicItem = (logicItem: TSurveyLogic): TSurveyLogic => {
  const duplicateConditionGroup = (group: TConditionGroup): TConditionGroup => {
    return {
      ...group,
      id: createId(),
      conditions: group.conditions.map((condition) => {
        if (isConditionGroup(condition)) {
          return duplicateConditionGroup(condition);
        } else {
          return duplicateCondition(condition);
        }
      }),
    };
  };

  const duplicateCondition = (condition: TSingleCondition): TSingleCondition => {
    return {
      ...condition,
      id: createId(),
    };
  };

  const duplicateAction = (action: TSurveyLogicAction): TSurveyLogicAction => {
    return {
      ...action,
      id: createId(),
    };
  };

  return {
    ...logicItem,
    id: createId(),
    conditions: duplicateConditionGroup(logicItem.conditions),
    actions: logicItem.actions.map(duplicateAction),
  };
};

export const addConditionBelow = (
  group: TConditionGroup,
  resourceId: string,
  condition: TSingleCondition
) => {
  for (let i = 0; i < group.conditions.length; i++) {
    const item = group.conditions[i];

    if (isConditionGroup(item)) {
      if (item.id === resourceId) {
        group.conditions.splice(i + 1, 0, condition);
        break;
      } else {
        addConditionBelow(item, resourceId, condition);
      }
    } else {
      if (item.id === resourceId) {
        group.conditions.splice(i + 1, 0, condition);
        break;
      }
    }
  }
};

export const toggleGroupConnector = (group: TConditionGroup, resourceId: string) => {
  if (group.id === resourceId) {
    group.connector = group.connector === "and" ? "or" : "and";
    return;
  }

  for (const condition of group.conditions) {
    if (condition.connector) {
      toggleGroupConnector(condition, resourceId);
    }
  }
};

export const removeCondition = (group: TConditionGroup, resourceId: string) => {
  for (let i = 0; i < group.conditions.length; i++) {
    const item = group.conditions[i];

    if (item.id === resourceId) {
      group.conditions.splice(i, 1);
      return;
    }

    if (isConditionGroup(item)) {
      removeCondition(item, resourceId);
    }
  }

  deleteEmptyGroups(group);
};

export const duplicateCondition = (group: TConditionGroup, resourceId: string) => {
  for (let i = 0; i < group.conditions.length; i++) {
    const item = group.conditions[i];

    if (item.id === resourceId) {
      const newItem: TCondition = {
        ...item,
        id: createId(),
      };
      group.conditions.splice(i + 1, 0, newItem);
      return;
    }

    if (item.connector) {
      duplicateCondition(item, resourceId);
    }
  }
};

export const deleteEmptyGroups = (group: TConditionGroup) => {
  for (let i = 0; i < group.conditions.length; i++) {
    const resource = group.conditions[i];

    if (isConditionGroup(resource) && resource.conditions.length === 0) {
      group.conditions.splice(i, 1);
    } else if (isConditionGroup(resource)) {
      deleteEmptyGroups(resource);
    }
  }
};

export const createGroupFromResource = (group: TConditionGroup, resourceId: string) => {
  for (let i = 0; i < group.conditions.length; i++) {
    const item = group.conditions[i];

    if (item.id === resourceId) {
      const newGroup: TConditionGroup = {
        id: createId(),
        connector: "and",
        conditions: [item],
      };
      group.conditions[i] = newGroup;
      group.connector = group.connector ?? "and";
      return;
    }

    if (isConditionGroup(item)) {
      createGroupFromResource(item, resourceId);
    }
  }
};

export const updateCondition = (
  group: TConditionGroup,
  resourceId: string,
  condition: Partial<TSingleCondition>
) => {
  for (let i = 0; i < group.conditions.length; i++) {
    const item = group.conditions[i];

    if (item.id === resourceId && !("connector" in item)) {
      group.conditions[i] = { ...item, ...condition } as TSingleCondition;
      return;
    }

    if (isConditionGroup(item)) {
      updateCondition(item, resourceId, condition);
    }
  }
};

export const getUpdatedActionBody = (
  action: TSurveyLogicAction,
  objective: TActionObjective
): TSurveyLogicAction => {
  if (objective === action.objective) return action;
  switch (objective) {
    case "calculate":
      return {
        id: action.id,
        objective: "calculate",
        variableId: "",
        operator: "assign",
        value: { type: "static", value: "" },
      };
    case "requireAnswer":
      return {
        id: action.id,
        objective: "requireAnswer",
        target: "",
      };
    case "jumpToQuestion":
      return {
        id: action.id,
        objective: "jumpToQuestion",
        target: "",
      };
  }
};

export const evaluateLogic = (
  localSurvey: TJsEnvironmentStateSurvey,
  data: TResponseData,
  variablesData: TResponseVariables,
  conditions: TConditionGroup,
  selectedLanguage: string
): boolean => {
  const evaluateConditionGroup = (group: TConditionGroup): boolean => {
    const results = group.conditions.map((condition) => {
      if (isConditionGroup(condition)) {
        return evaluateConditionGroup(condition);
      } else {
        return evaluateSingleCondition(localSurvey, data, variablesData, condition, selectedLanguage);
      }
    });

    return group.connector === "or" ? results.some((r) => r) : results.every((r) => r);
  };

  return evaluateConditionGroup(conditions);
};

const evaluateSingleCondition = (
  localSurvey: TJsEnvironmentStateSurvey,
  data: TResponseData,
  variablesData: TResponseVariables,
  condition: TSingleCondition,
  selectedLanguage: string
): boolean => {
  try {
    let leftValue = getLeftOperandValue(
      localSurvey,
      data,
      variablesData,
      condition.leftOperand,
      selectedLanguage
    );
    let rightValue = condition.rightOperand
      ? getRightOperandValue(localSurvey, data, variablesData, condition.rightOperand)
      : undefined;

    let leftField: TSurveyQuestion | TSurveyVariable | string;

    if (condition.leftOperand?.type === "question") {
      leftField = localSurvey.questions.find((q) => q.id === condition.leftOperand?.value) as TSurveyQuestion;
    } else if (condition.leftOperand?.type === "variable") {
      leftField = localSurvey.variables.find((v) => v.id === condition.leftOperand?.value) as TSurveyVariable;
    } else if (condition.leftOperand?.type === "hiddenField") {
      leftField = condition.leftOperand.value as string;
    } else {
      leftField = "";
    }

    let rightField: TSurveyQuestion | TSurveyVariable | string;

    if (condition.rightOperand?.type === "question") {
      rightField = localSurvey.questions.find(
        (q) => q.id === condition.rightOperand?.value
      ) as TSurveyQuestion;
    } else if (condition.rightOperand?.type === "variable") {
      rightField = localSurvey.variables.find(
        (v) => v.id === condition.rightOperand?.value
      ) as TSurveyVariable;
    } else if (condition.rightOperand?.type === "hiddenField") {
      rightField = condition.rightOperand.value as string;
    } else {
      rightField = "";
    }

    if (
      condition.leftOperand.type === "variable" &&
      (leftField as TSurveyVariable).type === "number" &&
      condition.rightOperand?.type === "hiddenField"
    ) {
      rightValue = Number(rightValue as string);
    }

    switch (condition.operator) {
      case "equals":
        if (condition.leftOperand.type === "question") {
          if (
            (leftField as TSurveyQuestion).type === TSurveyQuestionTypeEnum.Date &&
            typeof leftValue === "string" &&
            typeof rightValue === "string"
          ) {
            // when left value is of date question and right value is string
            return new Date(leftValue).getTime() === new Date(rightValue).getTime();
          }
        }

        // when left value is of openText, hiddenField, variable and right value is of multichoice
        if (condition.rightOperand?.type === "question") {
          if ((rightField as TSurveyQuestion).type === TSurveyQuestionTypeEnum.MultipleChoiceMulti) {
            if (Array.isArray(rightValue) && typeof leftValue === "string" && rightValue.length === 1) {
              return rightValue.includes(leftValue as string);
            } else return false;
          } else if (
            (rightField as TSurveyQuestion).type === TSurveyQuestionTypeEnum.Date &&
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
          condition.leftOperand.type === "question" &&
          (leftField as TSurveyQuestion).type === TSurveyQuestionTypeEnum.PictureSelection &&
          Array.isArray(leftValue) &&
          leftValue.length > 0 &&
          typeof rightValue === "string"
        ) {
          return !leftValue.includes(rightValue);
        }

        // when left value is of date question and right value is string
        if (
          condition.leftOperand.type === "question" &&
          (leftField as TSurveyQuestion).type === TSurveyQuestionTypeEnum.Date &&
          typeof leftValue === "string" &&
          typeof rightValue === "string"
        ) {
          return new Date(leftValue).getTime() !== new Date(rightValue).getTime();
        }

        // when left value is of openText, hiddenField, variable and right value is of multichoice
        if (condition.rightOperand?.type === "question") {
          if ((rightField as TSurveyQuestion).type === TSurveyQuestionTypeEnum.MultipleChoiceMulti) {
            if (Array.isArray(rightValue) && typeof leftValue === "string" && rightValue.length === 1) {
              return !rightValue.includes(leftValue as string);
            } else return false;
          } else if (
            (rightField as TSurveyQuestion).type === TSurveyQuestionTypeEnum.Date &&
            typeof leftValue === "string" &&
            typeof rightValue === "string"
          ) {
            return new Date(leftValue).getTime() !== new Date(rightValue).getTime();
          }
        }

        return (
          (Array.isArray(leftValue) &&
            leftValue.length === 1 &&
            typeof rightValue === "string" &&
            !leftValue.includes(rightValue)) ||
          leftValue !== rightValue
        );
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
            condition.leftOperand.type === "question" &&
            (leftField as TSurveyQuestion).type === TSurveyQuestionTypeEnum.FileUpload &&
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
          rightValue.some((v) => !leftValue.includes(v))
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
      case "isSet":
        return leftValue !== undefined && leftValue !== null && leftValue !== "";
      case "isNotSet":
        return leftValue === undefined || leftValue === null || leftValue === "";
      case "is":
        return leftValue === rightValue;
      case "isNot":
        return leftValue !== rightValue;
      case "isEmpty":
        return leftValue === "";
      case "isNotEmpty":
        return leftValue !== "" && leftValue !== null && leftValue !== undefined;
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

const getVariableValue = (
  variables: TSurveyVariable[],
  variableId: string,
  variablesData: TResponseVariables
) => {
  const variable = variables.find((v) => v.id === variableId);
  if (!variable) return undefined;
  const variableValue = variablesData[variableId];
  return variable.type === "number" ? Number(variableValue) || 0 : variableValue || "";
};

const getLeftOperandValue = (
  localSurvey: TJsEnvironmentStateSurvey,
  data: TResponseData,
  variablesData: TResponseVariables,
  leftOperand: TSingleCondition["leftOperand"],
  selectedLanguage: string
) => {
  switch (leftOperand.type) {
    case "question":
      const currentQuestion = localSurvey.questions.find((q) => q.id === leftOperand.value);
      if (!currentQuestion) return undefined;

      const responseValue = data[leftOperand.value];

      if (currentQuestion.type === "openText" && currentQuestion.inputType === "number") {
        return Number(responseValue) || undefined;
      }

      if (currentQuestion.type === "multipleChoiceSingle" || currentQuestion.type === "multipleChoiceMulti") {
        const isOthersEnabled = currentQuestion.choices.at(-1)?.id === "other";

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
        if (leftOperand.meta && leftOperand.meta.row !== undefined) {
          const rowIndex = Number(leftOperand.meta.row);

          if (isNaN(rowIndex) || rowIndex < 0 || rowIndex >= currentQuestion.rows.length) {
            return undefined;
          }
          const row = getLocalizedValue(currentQuestion.rows[rowIndex], selectedLanguage);

          const rowValue = responseValue[row];
          if (rowValue === "") return "";

          if (rowValue) {
            const columnIndex = currentQuestion.columns.findIndex((column) => {
              return getLocalizedValue(column, selectedLanguage) === rowValue;
            });
            if (columnIndex === -1) return undefined;
            return columnIndex.toString();
          }
          return undefined;
        }
      }

      return data[leftOperand.value];
    case "variable":
      const variables = localSurvey.variables || [];
      return getVariableValue(variables, leftOperand.value, variablesData);
    case "hiddenField":
      return data[leftOperand.value];
    default:
      return undefined;
  }
};

const getRightOperandValue = (
  localSurvey: TJsEnvironmentStateSurvey,
  data: TResponseData,
  variablesData: TResponseVariables,
  rightOperand: TSingleCondition["rightOperand"]
) => {
  if (!rightOperand) return undefined;

  switch (rightOperand.type) {
    case "question":
      return data[rightOperand.value];
    case "variable":
      const variables = localSurvey.variables || [];
      return getVariableValue(variables, rightOperand.value, variablesData);
    case "hiddenField":
      return data[rightOperand.value];
    case "static":
      return rightOperand.value;
    default:
      return undefined;
  }
};

export const performActions = (
  survey: TJsEnvironmentStateSurvey,
  actions: TSurveyLogicAction[],
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
  survey: TJsEnvironmentStateSurvey,
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
