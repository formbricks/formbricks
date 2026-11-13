import { TSurveyElementTypeEnum } from "./constants";
import { isDateAfter, isDateBefore } from "./date-comparison";
import type { TSurveyLogicConditionsOperator } from "./logic";

/**
 * What the caller knows about the two sides beyond their values. Survey logic fills it from the
 * survey's elements and Embedded Data fields; a workflow If/else has no survey element behind a
 * Variable and passes nothing, so the plain value rules apply.
 */
export interface TConditionComparisonContext {
  /** Element type when the left operand is a survey element that exists. */
  leftElementType?: TSurveyElementTypeEnum;
  /** Element type when the right operand is a survey element that exists. */
  rightElementType?: TSurveyElementTypeEnum;
  /**
   * `compareDateValues(left, right)` when either side is a date field (ENG-6935). A number decides
   * "equals" and "does not equal" by calendar day; `undefined` leaves them to the value rules.
   */
  dateOrder?: number;
}

const isDateElement = (type: TSurveyElementTypeEnum | undefined): boolean =>
  type === TSurveyElementTypeEnum.Date;

const sameInstant = (left: string, right: string): boolean =>
  new Date(left).getTime() === new Date(right).getTime();

const compareEquals = (
  leftValue: unknown,
  rightValue: unknown,
  context: TConditionComparisonContext
): boolean => {
  if (context.dateOrder !== undefined) return context.dateOrder === 0;
  // when left value is of date element and right value is string
  if (
    isDateElement(context.leftElementType) &&
    typeof leftValue === "string" &&
    typeof rightValue === "string"
  ) {
    return sameInstant(leftValue, rightValue);
  }

  // when left value is of openText, hiddenField, variable and right value is of multichoice
  if (context.rightElementType === TSurveyElementTypeEnum.MultipleChoiceMulti) {
    if (Array.isArray(rightValue) && typeof leftValue === "string" && rightValue.length === 1) {
      return rightValue.includes(leftValue);
    }
    return false;
  }
  if (
    isDateElement(context.rightElementType) &&
    typeof leftValue === "string" &&
    typeof rightValue === "string"
  ) {
    return sameInstant(leftValue, rightValue);
  }

  return (
    (Array.isArray(leftValue) &&
      leftValue.length === 1 &&
      typeof rightValue === "string" &&
      leftValue.includes(rightValue)) ||
    leftValue === rightValue
  );
};

const compareDoesNotEqual = (
  leftValue: unknown,
  rightValue: unknown,
  context: TConditionComparisonContext
): boolean => {
  if (context.dateOrder !== undefined) return context.dateOrder !== 0;
  // when left value is of picture selection element and right value is its option
  if (
    context.leftElementType === TSurveyElementTypeEnum.PictureSelection &&
    Array.isArray(leftValue) &&
    leftValue.length > 0 &&
    typeof rightValue === "string"
  ) {
    return !leftValue.includes(rightValue);
  }

  // when left value is of date element and right value is string
  if (
    isDateElement(context.leftElementType) &&
    typeof leftValue === "string" &&
    typeof rightValue === "string"
  ) {
    return !sameInstant(leftValue, rightValue);
  }

  // when left value is of openText, hiddenField, variable and right value is of multichoice
  if (context.rightElementType === TSurveyElementTypeEnum.MultipleChoiceMulti) {
    if (Array.isArray(rightValue) && typeof leftValue === "string" && rightValue.length === 1) {
      return !rightValue.includes(leftValue);
    }
    return false;
  }
  if (
    isDateElement(context.rightElementType) &&
    typeof leftValue === "string" &&
    typeof rightValue === "string"
  ) {
    return !sameInstant(leftValue, rightValue);
  }

  // decide inside the guard: OR-ing past it would fall through to `leftValue !== rightValue`,
  // which is always true for an array vs. a string (a matching single selection included)
  if (Array.isArray(leftValue) && leftValue.length === 1 && typeof rightValue === "string") {
    return !leftValue.includes(rightValue);
  }

  return leftValue !== rightValue;
};

const compareLists = (
  leftValue: unknown,
  rightValue: unknown,
  match: (left: unknown[], right: unknown[]) => boolean
): boolean => Array.isArray(leftValue) && Array.isArray(rightValue) && match(leftValue, rightValue);

const isSubmittedValue = (leftValue: unknown, context: TConditionComparisonContext): boolean => {
  if (typeof leftValue === "string") {
    if (context.leftElementType === TSurveyElementTypeEnum.FileUpload && leftValue) {
      return leftValue !== "skipped";
    }
    return leftValue !== "";
  }
  if (Array.isArray(leftValue)) return leftValue.length > 0;
  return typeof leftValue === "number";
};

const compare = (
  operator: TSurveyLogicConditionsOperator,
  leftValue: unknown,
  rightValue: unknown,
  context: TConditionComparisonContext
): boolean => {
  switch (operator) {
    case "equals":
      return compareEquals(leftValue, rightValue, context);
    case "doesNotEqual":
      return compareDoesNotEqual(leftValue, rightValue, context);
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
      return isSubmittedValue(leftValue, context);
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
    case "isAnyOf":
      return Array.isArray(rightValue) && typeof leftValue === "string" && rightValue.includes(leftValue);
    case "includesAllOf":
      return compareLists(leftValue, rightValue, (left, right) => right.every((v) => left.includes(v)));
    case "includesOneOf":
      return compareLists(leftValue, rightValue, (left, right) => right.some((v) => left.includes(v)));
    case "doesNotIncludeAllOf":
      return compareLists(leftValue, rightValue, (left, right) => !right.every((v) => left.includes(v)));
    case "doesNotIncludeOneOf":
      return compareLists(leftValue, rightValue, (left, right) => !right.some((v) => left.includes(v)));
    case "isAccepted":
      return leftValue === "accepted";
    case "isClicked":
      return leftValue === "clicked";
    case "isNotClicked":
      return leftValue !== "clicked";
    case "isAfter":
      return isDateAfter(leftValue, rightValue);
    case "isBefore":
      return isDateBefore(leftValue, rightValue);
    case "isBooked":
      return leftValue === "booked" || !!(leftValue && leftValue !== "");
    case "isPartiallySubmitted":
      if (typeof leftValue === "object") {
        return Object.values(leftValue as object).includes("");
      }
      return false;
    case "isCompletelySubmitted":
      if (typeof leftValue === "object") {
        const values = Object.values(leftValue as object);
        return values.length > 0 && !values.includes("");
      }
      return false;
    case "isSet":
    case "isNotEmpty":
      return leftValue !== undefined && leftValue !== null && leftValue !== "";
    case "isNotSet":
      return leftValue === undefined || leftValue === null || leftValue === "";
    case "isEmpty":
      return leftValue === "";
    default:
      return false;
  }
};

/**
 * The one comparison behind every logic condition (ADR 0046): survey logic in the renderer
 * (`packages/surveys/src/lib/logic.ts`), survey logic on the server (`apps/web/lib/surveyLogic/utils.ts`)
 * and a workflow's If/else all call it, so a number sent as `"412"` or a multi-select answer
 * compares the same everywhere.
 *
 * Pure: the caller resolves the operand values (and any matrix column position) and says what it
 * knows about the survey elements behind them through `context`. A comparison that throws (an
 * object operator on `null`) reads as not matched, as both survey engines always did.
 */
export const compareConditionValues = (
  operator: TSurveyLogicConditionsOperator,
  leftValue: unknown,
  rightValue: unknown,
  context: TConditionComparisonContext = {}
): boolean => {
  try {
    return compare(operator, leftValue, rightValue, context);
  } catch {
    return false;
  }
};
