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
  type TActionCalculate as TBlockActionCalculate,
  TSurveyBlockLogic,
  TSurveyBlockLogicAction,
  TSurveyBlockLogicActionObjective,
} from "@formbricks/types/surveys/blocks";
import { evaluateBooleanAssign } from "@formbricks/types/surveys/boolean-assign";
import {
  compareDateValues,
  isDateAfter,
  isDateBefore,
  isDateFieldOperand,
} from "@formbricks/types/surveys/date-comparison";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { evaluateSetValue } from "@formbricks/types/surveys/expression-evaluation";
import { findByLocalizedLabel, findMatrixRowKey } from "@formbricks/types/surveys/localized-label";
import { TConditionGroup, TSingleCondition } from "@formbricks/types/surveys/logic";
import { evaluateConditionGroup } from "@formbricks/types/surveys/logic-evaluation";
import {
  isMatrixRowCondition,
  namesUnknownMatrixId,
  resolveMatrixColumnValue,
  resolveMatrixRowIndex,
} from "@formbricks/types/surveys/matrix-conditions";
import { TActionCalculate, TSurveyLogicAction } from "@formbricks/types/surveys/types";
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
      group.conditions[i] = { ...item, ...condition };
      return;
    }

    if (isConditionGroup(item)) {
      updateCondition(item, resourceId, condition);
    }
  }
};

/**
 * The empty Set value action: Assign, an empty value, with the editor's Expression switch off. A new rule
 * from the Add logic menu and an action switched to Set value both start here (ENG-6969 review, supersedes
 * P63 and the expression-on start of P73); the switch turns it into an expression. Refused on save until
 * filled in. A date field starts from {@link createEmptyFormulaAction} instead.
 */
export const createEmptySetValueAction = (id: string, variableId = ""): TSurveyBlockLogicAction => ({
  id,
  objective: "calculate",
  variableId,
  operator: "assign",
  value: { type: "static", value: "" },
});

/**
 * The empty Set value action stored as an expression. A date field needs it even in one step: the
 * schema has no one-step date value, so the editor shows this leaf as its Assign row (P38, ENG-6968).
 */
export const createEmptyFormulaAction = (id: string, variableId = ""): TSurveyBlockLogicAction => ({
  id,
  objective: "calculate",
  variableId,
  operator: "assign",
  value: { type: "expression", value: { type: "static", value: "" } },
});

export const getUpdatedActionBody = (
  action: TSurveyBlockLogicAction,
  objective: TSurveyBlockLogicActionObjective
): TSurveyBlockLogicAction => {
  if (objective === action.objective) return action;
  switch (objective) {
    case "calculate":
      return createEmptySetValueAction(action.id);
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
    case "markLowQuality":
      return { id: action.id, objective: "markLowQuality" };
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
 * The declared names come from the **stored rows**, the only place a saved survey's fields live
 * (ENG-2404) — every caller here holds a saved survey. The editor, whose working copy can run ahead
 * of what is stored, does not call this.
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
  elements: TSurveyElement[],
  operand: TSingleCondition["leftOperand"] | TSingleCondition["rightOperand"]
): TSurveyElement | string => {
  if (operand?.type === "element") return elements.find((q) => q.id === operand.value) ?? "";
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
  // when left value is of date element and right value is string
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

  const elements = getElementsFromBlocks(localSurvey.blocks);
  const computedFields = getComputedEmbeddedFields(localSurvey);
  const leftField = getOperandField(elements, condition.leftOperand);
  const rightField = getOperandField(elements, condition.rightOperand);

  if (
    condition.leftOperand.type === "variable" &&
    getComputedFieldDataType(computedFields, condition.leftOperand.value) === "number" &&
    // `reserved` alongside `hiddenField` as defence in depth. A *projected* reserved value does not
    // need it: the catalog read seam runs `coerceToEmbeddedDataType`, so `durationSeconds` and the
    // other number-typed entries arrive here as JS numbers and `Number()` is a no-op. What this
    // guards is the one shape the map can still hold as a string — `mergeReservedValues` overlays
    // `response.data` on the projection unconditionally, so a reserved key that is also a response
    // key carries that raw string past the seam.
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
  currentElement: TChoiceElement,
  responseValue: TResponseData[string] | undefined,
  selectedLanguage: string
) => {
  // "Other" need not be last: "None of the above" can follow it (ENG-7377).
  const isOthersEnabled = currentElement.choices.some((choice) => choice.id === "other");

  // ENG-6943: the label in the response's language first, then in any language of the survey.
  if (typeof responseValue === "string") {
    const choice = findByLocalizedLabel(currentElement.choices, responseValue, selectedLanguage);

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
      const foundChoice = findByLocalizedLabel(currentElement.choices, value, selectedLanguage);

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
  currentElement: TMatrixElement,
  meta: TElementOperand["meta"],
  responseValue: Record<string, string>,
  selectedLanguage: string
) => {
  // ENG-6934: the row id first, the position as the fallback; an unknown id is no row.
  const rowIndex = resolveMatrixRowIndex(currentElement, meta);
  if (rowIndex === undefined) return undefined;

  const row = findMatrixRowKey(currentElement.rows[rowIndex].label, responseValue, selectedLanguage);

  const rowValue = row === undefined ? undefined : responseValue[row];
  if (rowValue === "") return "";

  if (typeof rowValue === "string") {
    const column = findByLocalizedLabel(currentElement.columns, rowValue, selectedLanguage);
    if (!column) return undefined;
    return currentElement.columns.indexOf(column).toString();
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
  const elements = getElementsFromBlocks(localSurvey.blocks);
  const currentElement = elements.find((q) => q.id === leftOperand.value);
  if (!currentElement) return undefined;

  const responseValue = data[leftOperand.value];

  if (currentElement.type === "openText" && currentElement.inputType === "number") {
    return getNumberAnswerValue(responseValue);
  }

  if (currentElement.type === "multipleChoiceSingle" || currentElement.type === "multipleChoiceMulti") {
    return getChoiceAnswerValue(currentElement, responseValue, selectedLanguage);
  }

  // T21 (ENG-6937): a ranking stores the ranked labels in the respondent's language; conditions name
  // option ids, so "was ranked" maps each label back, as multi select does.
  if (currentElement.type === "ranking" && Array.isArray(responseValue)) {
    return responseValue.flatMap((value) => {
      const choice = findByLocalizedLabel(currentElement.choices, value, selectedLanguage);
      return choice ? [choice.id] : [];
    });
  }

  if (
    currentElement.type === "matrix" &&
    typeof responseValue === "object" &&
    !Array.isArray(responseValue) &&
    isMatrixRowCondition(leftOperand.meta)
  ) {
    return getMatrixRowAnswerValue(currentElement, leftOperand.meta, responseValue, selectedLanguage);
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

/**
 * What a Set value expression reads beyond answers and variables: the respondent's language (a
 * single-select answer yields its answer code) and the reserved-field map a `reserved` leaf reads —
 * {@link buildServerEmbeddedValues} for a persisted response.
 */
export interface TPerformActionsContext {
  selectedLanguage?: string;
  embeddedValues?: TResponseData;
}

export const performActions = (
  survey: TJsWorkspaceStateSurvey,
  actions: TSurveyBlockLogicAction[] | TSurveyLogicAction[],
  data: TResponseData,
  calculationResults: TResponseVariables,
  context: TPerformActionsContext = {}
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
      case "calculate": {
        const result = performCalculation(survey, action, data, calculations, context);
        if (result !== undefined) calculations[action.variableId] = result;
        break;
      }
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

/**
 * Whether an answer or hidden field reads as a number. Blank text is not one: `Number("")` is 0, which
 * would turn an empty field into a real 0 and stop an `isSkipped` condition from seeing it. Same rule
 * as the survey bundle (packages/surveys/src/lib/logic.ts).
 */
const isNumericOperand = (val: string | number): boolean =>
  typeof val === "number" || (val.trim() !== "" && !Number.isNaN(Number(val)));

/** The value a one-step calculation applies: a static value, a variable, or an answer. */
const getCalculationOperand = (
  action: TActionCalculate | TBlockActionCalculate,
  data: TResponseData,
  calculations: TResponseVariables,
  dataType: string
): string | number | undefined => {
  // Determine the operand value based on the action.value type
  switch (action.value.type) {
    case "static":
      // True and False belong to a true/false field, handled in performCalculation.
      return typeof action.value.value === "boolean" ? undefined : action.value.value;
    case "variable": {
      const value = calculations[action.value.value];
      return typeof value === "number" || typeof value === "string" ? value : undefined;
    }
    // Deliberately no `default` arm: a legacy `"question"` operand (admitted at the type level by
    // ZDynamicLogicFieldValueDeprecated, normalized away at the API boundary) stays unresolved and
    // the calculation returns undefined, exactly as before.
    case "element":
    case "hiddenField": {
      const val = data[action.value.value];
      if (typeof val !== "number" && typeof val !== "string") return undefined;
      return dataType === "number" && isNumericOperand(val) ? Number(val) : val;
    }
  }
  return undefined;
};

/** A field's value as a one-step operator starts from: `0` / `""` when unset, a boolean as its text. */
const getOneStepCurrentValue = (
  storedValue: TResponseVariables[string] | undefined,
  dataType: string
): string | number => {
  if (storedValue === undefined) return dataType === "number" ? 0 : "";
  return typeof storedValue === "boolean" ? String(storedValue) : storedValue;
};

/** Applies a one-step operator; `undefined` for a division by zero. */
const applyCalculationOperator = (
  operator: (TActionCalculate | TBlockActionCalculate)["operator"],
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
  action: TActionCalculate | TBlockActionCalculate,
  data: TResponseData,
  calculations: TResponseVariables,
  context: TPerformActionsContext
): TResponseVariables[string] | undefined => {
  const computedField = findComputedEmbeddedField(getComputedEmbeddedFields(survey), action.variableId);

  if (!computedField) return undefined;

  const { dataType } = computedField.field;

  // ENG-6973: a true/false field is assigned True, False or another true/false field, as a real
  // boolean, by the same rule as the survey bundle.
  if (dataType === "boolean") return evaluateBooleanAssign(action, data, calculations);

  // Set value (ENG-6935): the shared evaluator, as in the survey bundle, "empty in, empty out". An
  // empty result is written as "" so it clears the field; the one-step operators below keep "empty
  // counts as 0".
  if (action.value.type === "expression") {
    return evaluateSetValue(action.value.value, dataType, {
      survey,
      data,
      variables: calculations,
      reservedValues: context.embeddedValues,
      language: context.selectedLanguage ?? "default",
    });
  }

  const currentValue = getOneStepCurrentValue(calculations[action.variableId], dataType);
  const operandValue = getCalculationOperand(action, data, calculations, dataType);
  if (operandValue === undefined || operandValue === null) return undefined;

  return applyCalculationOperator(action.operator, currentValue, operandValue);
};
