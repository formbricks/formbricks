import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import type { TResponseData } from "@formbricks/types/responses";
import type { TSurveyLogic, TSurveyQuestion } from "@formbricks/types/surveys";

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
        return responseValue !== "dismissed" && responseValue !== "" && responseValue !== null;
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
        responseValue === "dismissed" ||
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

export const hasRequirementsSatisfied = (question: TSurveyQuestion, data: TResponseData): boolean => {
  if (!(Array.isArray(question?.requirementsLogic) && question.requirementsLogic.length > 0)) {
    return true;
  }

  return question.requirementsLogic.every((logic) => {
    if (!logic.source) {
      console.warn("invalid source for logic", logic);
      return true;
    }

    const responseValue = data[logic.source];

    const isEvaluate = evaluateCondition(logic as TSurveyLogic, responseValue);
    return isEvaluate;
  });
};

export const getNextQuestionIdByLogicJump = (
  question: TSurveyQuestion,
  data: TResponseData,
  languageCode: string
) => {
  if (!(question?.logic && question?.logic.length > 0)) {
    return;
  }

  const responseValue = data[question.id];
  for (let logic of question.logic) {
    if (!logic.destination) continue;
    // Check if the current question is of type 'multipleChoiceSingle' or 'multipleChoiceMulti'
    if (question.type === "multipleChoiceSingle" || question.type === "multipleChoiceMulti") {
      let choice;

      // Check if the response is a string (applies to single choice questions)
      // Sonne -> sun
      if (typeof responseValue === "string") {
        // Find the choice in currentQuestion.choices that matches the responseValue after localization
        choice = question.choices.find((choice) => {
          return getLocalizedValue(choice.label, languageCode) === responseValue;
        })?.label;

        // If a matching choice is found, get its default localized value
        if (choice) {
          choice = getLocalizedValue(choice, "default");
        }
      }
      // Check if the response is an array (applies to multiple choices questions)
      // ["Sonne","Mond"]->["sun","moon"]
      else if (Array.isArray(responseValue)) {
        // Filter and map the choices in currentQuestion.choices that are included in responseValue after localization
        choice = question.choices
          .filter((choice) => {
            return responseValue.includes(getLocalizedValue(choice.label, languageCode));
          })
          .map((choice) => getLocalizedValue(choice.label, "default"));
      }

      // If a choice is determined (either single or multiple), evaluate the logic condition with that choice
      if (choice) {
        if (evaluateCondition(logic, choice)) {
          return logic.destination;
        }
      }
      // If choice is undefined, it implies an "other" option is selected. Evaluate the logic condition for "Other"
      else {
        if (evaluateCondition(logic, "Other")) {
          return logic.destination;
        }
      }
    }
    if (evaluateCondition(logic, responseValue)) {
      return logic.destination;
    }
  }
};
