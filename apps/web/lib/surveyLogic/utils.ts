import { createId } from "@paralleldrive/cuid2";
import {
  RESERVED_FIELD_CATALOG,
  type TEmbeddedFieldsSurvey,
  type TEmbeddedValueResponse,
  dropShadowedReservedEntries,
  findComputedEmbeddedField,
  getComputedEmbeddedFields,
  getComputedFieldDataType,
  getLogicVariableValue,
  getSurveyEmbeddedFields,
  listShadowingNames,
  mergeReservedValues,
  projectReservedValues,
} from "@formbricks/types/embedded-data-resolver";
import { TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { TResponseData, TResponseVariables } from "@formbricks/types/responses";
import {
  TSurveyBlockLogic,
  TSurveyBlockLogicAction,
  TSurveyBlockLogicActionObjective,
} from "@formbricks/types/surveys/blocks";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TConditionGroup, TSingleCondition } from "@formbricks/types/surveys/logic";
import { evaluateConditionGroup } from "@formbricks/types/surveys/logic-evaluation";
import { TActionCalculate, TSurveyLogicAction } from "@formbricks/types/surveys/types";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

type TCondition = TSingleCondition | TConditionGroup;

export const isConditionGroup = (condition: TCondition): condition is TConditionGroup => {
  return (condition as TConditionGroup).connector !== undefined;
};

export const duplicateLogicItem = (logicItem: TSurveyBlockLogic): TSurveyBlockLogic => {
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

  const duplicateAction = (action: TSurveyBlockLogicAction): TSurveyBlockLogicAction => {
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

export const removeCondition = (group: TConditionGroup, resourceId: string): boolean => {
  for (let i = group.conditions.length - 1; i >= 0; i--) {
    const item = group.conditions[i];

    if (item.id === resourceId) {
      group.conditions.splice(i, 1);
      cleanupGroup(group);
      return true;
    }

    if (isConditionGroup(item) && removeCondition(item, resourceId)) {
      cleanupGroup(group);
      return true;
    }
  }

  return false;
};

const cleanupGroup = (group: TConditionGroup) => {
  // Remove empty condition groups first
  for (let i = group.conditions.length - 1; i >= 0; i--) {
    const condition = group.conditions[i];
    if (isConditionGroup(condition)) {
      cleanupGroup(condition);

      // Remove if empty after cleanup
      if (condition.conditions.length === 0) {
        group.conditions.splice(i, 1);
      }
    }
  }

  // Flatten if group has only one condition and it's a condition group
  if (group.conditions.length === 1 && isConditionGroup(group.conditions[0])) {
    group.connector = group.conditions[0].connector || "and";
    group.conditions = group.conditions[0].conditions;
  }
};

export const deleteEmptyGroups = (group: TConditionGroup) => {
  cleanupGroup(group);
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
  action: TSurveyBlockLogicAction,
  objective: TSurveyBlockLogicActionObjective
): TSurveyBlockLogicAction => {
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
    case "jumpToBlock":
      return {
        id: action.id,
        objective: "jumpToBlock",
        target: "",
      };
    default:
      return action;
  }
};

/** The survey slice {@link buildServerEmbeddedValues} needs to know what the survey declares. */
export type TServerEmbeddedValuesSurvey = TEmbeddedFieldsSurvey & {
  blocks: TJsWorkspaceStateSurvey["blocks"];
};

/**
 * The reserved-field lookup map for a **persisted** response: every catalog entry the survey does
 * not declare itself, projected, then shadowed once more by the response's own data.
 *
 * Server-side every reserved field is knowable, so this reads `RESERVED_FIELD_CATALOG` whole rather
 * than the mid-survey subset — the renderer's `projectClientReservedValues` exists precisely because
 * that is *not* true in the browser.
 *
 * **The survey parameter is what makes the grandfather rule work at all (ENG-2538).** This used to
 * take only a response, so it had nothing to filter by and leaned entirely on `mergeReservedValues`'s
 * spread — which loses only to a key that *exists*. A survey declaring an optional `url` therefore
 * resolved the reserved page URL for every response where the respondent left it blank, in quotas,
 * in server-side logic and (once ENG-2538 wired them up) on every display surface. Passing the survey
 * lets {@link dropShadowedReservedEntries} apply the same rule the pickers already applied.
 *
 * The declared names come from the **stored rows** rather than the legacy columns: every caller here
 * holds a saved survey, whose rows and declarations agree because every write path reconciles them in
 * the same transaction. The editor is the one context where they can diverge, and it does not call
 * this.
 */
export const buildServerEmbeddedValues = (
  response: TEmbeddedValueResponse,
  survey: TServerEmbeddedValuesSurvey
): TResponseData =>
  mergeReservedValues(
    projectReservedValues(
      dropShadowedReservedEntries(
        RESERVED_FIELD_CATALOG,
        listShadowingNames(
          getSurveyEmbeddedFields(survey),
          getElementsFromBlocks(survey.blocks).map((element) => element.id)
        )
      ),
      response
    ),
    response.data
  );

/**
 * @param embeddedValues Reserved-field values merged UNDER `data` by `mergeReservedValues` — what a
 *   `reserved` operand reads. Server-side callers holding a real `TResponse` should build this with
 *   {@link buildServerEmbeddedValues} so the **full** catalog resolves (country, durationSeconds,
 *   finished, …), not just the mid-survey subset the renderer can see. Defaults to `{}` for callers
 *   with no response in hand — quota screening evaluates before the row exists — where every
 *   reserved operand then reads as unset rather than throwing.
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

    const elements = getElementsFromBlocks(localSurvey.blocks);

    const computedFields = getComputedEmbeddedFields(localSurvey);

    // Only element and hiddenField operands are inspected below; a `variable` operand's declared
    // type is read through `getComputedFieldDataType` instead, which tolerates a condition naming a
    // field the survey no longer declares.
    let leftField: TSurveyElement | string;

    if (condition.leftOperand?.type === "element") {
      leftField = elements.find((q) => q.id === condition.leftOperand?.value) ?? "";
    } else if (condition.leftOperand?.type === "hiddenField") {
      leftField = condition.leftOperand.value as string;
    } else {
      leftField = "";
    }

    let rightField: TSurveyElement | string;

    if (condition.rightOperand?.type === "element") {
      rightField = elements.find((q) => q.id === condition.rightOperand?.value) ?? "";
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
            // when left value is of date element and right value is string
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
        // when left value is of picture selection element and right value is its option
        if (
          condition.leftOperand.type === "element" &&
          (leftField as TSurveyElement).type === TSurveyElementTypeEnum.PictureSelection &&
          Array.isArray(leftValue) &&
          leftValue.length > 0 &&
          typeof rightValue === "string"
        ) {
          return !leftValue.includes(rightValue);
        }

        // when left value is of date element and right value is string
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
      const elements = getElementsFromBlocks(localSurvey.blocks);
      const currentElement = elements.find((q) => q.id === leftOperand.value);
      if (!currentElement) return undefined;

      const responseValue = data[leftOperand.value];

      if (currentElement.type === "openText" && currentElement.inputType === "number") {
        if (responseValue === undefined) return undefined;
        if (typeof responseValue === "string" && responseValue.trim() === "") return undefined;

        const numberValue = typeof responseValue === "number" ? responseValue : Number(responseValue);
        return isNaN(numberValue) ? undefined : numberValue;
      }

      if (currentElement.type === "multipleChoiceSingle" || currentElement.type === "multipleChoiceMulti") {
        const isOthersEnabled = currentElement.choices.at(-1)?.id === "other";

        if (typeof responseValue === "string") {
          const choice = currentElement.choices.find((choice) => {
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
            const foundChoice = currentElement.choices.find((choice) => {
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
        currentElement.type === "matrix" &&
        typeof responseValue === "object" &&
        !Array.isArray(responseValue)
      ) {
        if (leftOperand.meta && leftOperand.meta.row !== undefined) {
          const rowIndex = Number(leftOperand.meta.row);

          if (isNaN(rowIndex) || rowIndex < 0 || rowIndex >= currentElement.rows.length) {
            return undefined;
          }
          const row = getLocalizedValue(currentElement.rows[rowIndex].label, selectedLanguage);

          const rowValue = responseValue[row];
          if (rowValue === "") return "";

          if (rowValue) {
            const columnIndex = currentElement.columns.findIndex((column) => {
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
    // Server-side the caller projects the FULL catalog, so country/durationSeconds/finished all
    // resolve here — unlike the renderer, which only ever sees the client-available subset.
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

export const performActions = (
  survey: TJsWorkspaceStateSurvey,
  actions: TSurveyBlockLogicAction[] | TSurveyLogicAction[],
  data: TResponseData,
  calculationResults: TResponseVariables
): {
  jumpTarget: string | undefined;
  requiredElementIds: string[];
  calculations: TResponseVariables;
} => {
  let jumpTarget: string | undefined;
  const requiredElementIds: string[] = [];
  const calculations: TResponseVariables = { ...calculationResults };

  actions.forEach((action) => {
    switch (action.objective) {
      case "calculate":
        const result = performCalculation(survey, action, data, calculations);
        if (result !== undefined) calculations[action.variableId] = result;
        break;
      case "requireAnswer":
        requiredElementIds.push(action.target);
        break;
      case "jumpToBlock":
        if (!jumpTarget) {
          jumpTarget = action.target;
        }
        break;
    }
  });

  return { jumpTarget, requiredElementIds, calculations };
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
        } else {
          operandValue = val;
        }
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
