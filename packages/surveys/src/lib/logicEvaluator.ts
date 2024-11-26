import { TSurveyLogic } from "@formbricks/types/surveys/types";

export const evaluateCondition = (
  logic: TSurveyLogic,
  responseValue: string | number | string[] | Record<string, string>
): boolean => {
  const isObject = typeof responseValue === "object" && responseValue !== null;
  switch (logic.condition) {
    case "equals":
      return (
        (Array.isArray(responseValue) &&
          responseValue.length === 1 &&
          typeof logic.value === "string" &&
          responseValue.includes(logic.value)) ||
        responseValue?.toString() === logic.value
      );
    case "notEquals":
      return responseValue !== logic.value;
    case "lessThan":
      return logic.value !== undefined && responseValue < logic.value;
    case "lessEqual":
      return logic.value !== undefined && responseValue <= logic.value;
    case "greaterThan":
      return logic.value !== undefined && responseValue > logic.value;
    case "greaterEqual":
      return logic.value !== undefined && responseValue >= logic.value;
    case "includesAll":
      return (
        Array.isArray(responseValue) &&
        Array.isArray(logic.value) &&
        logic.value.every((v) => responseValue.includes(v))
      );
    case "includesOne":
      if (!Array.isArray(logic.value)) return false;
      return Array.isArray(responseValue)
        ? logic.value.some((v) => responseValue.includes(v))
        : typeof responseValue === "string" && logic.value.includes(responseValue);

    case "accepted":
      return responseValue === "accepted";
    case "clicked":
      return responseValue === "clicked";
    case "submitted":
      if (typeof responseValue === "string") {
        return responseValue !== "" && responseValue !== null;
      } else if (Array.isArray(responseValue)) {
        return responseValue.length > 0;
      } else if (typeof responseValue === "number") {
        return responseValue !== null;
      }
      return false;
    case "skipped":
      return (
        (Array.isArray(responseValue) && responseValue.length === 0) ||
        responseValue === "" ||
        responseValue === null ||
        responseValue === undefined ||
        (isObject && Object.entries(responseValue).length === 0)
      );
    case "uploaded":
      if (Array.isArray(responseValue)) {
        return responseValue.length > 0;
      } else {
        return responseValue !== "skipped" && responseValue !== "" && responseValue !== null;
      }
    case "notUploaded":
      return (
        (Array.isArray(responseValue) && responseValue.length === 0) ||
        responseValue === "" ||
        responseValue === null ||
        responseValue === "skipped"
      );
    case "isCompletelySubmitted":
      if (isObject) {
        const values = Object.values(responseValue);
        return values.length > 0 && !values.includes("");
      } else return false;

    case "isPartiallySubmitted":
      if (isObject) {
        return Object.values(responseValue).includes("");
      } else return false;
    default:
      return false;
  }
};
