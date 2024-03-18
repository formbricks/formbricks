// extend this object in order to add more validation rules
import { toast } from "react-hot-toast";

import {
  TSurveyConsentQuestion,
  TSurveyMultipleChoiceMultiQuestion,
  TSurveyMultipleChoiceSingleQuestion,
  TSurveyPictureSelectionQuestion,
  TSurveyQuestion,
} from "@formbricks/types/surveys";

const validationRules = {
  multipleChoiceMulti: (question: TSurveyMultipleChoiceMultiQuestion) => {
    return !question.choices.some((element) => element.label.trim() === "");
  },
  multipleChoiceSingle: (question: TSurveyMultipleChoiceSingleQuestion) => {
    return !question.choices.some((element) => element.label.trim() === "");
  },
  consent: (question: TSurveyConsentQuestion) => {
    return question.label.trim() !== "";
  },
  pictureSelection: (question: TSurveyPictureSelectionQuestion) => {
    return question.choices.length >= 2;
  },
  defaultValidation: (question: TSurveyQuestion) => {
    return question.headline.trim() !== "";
  },
};

const validateQuestion = (question) => {
  const specificValidation = validationRules[question.type];
  const defaultValidation = validationRules.defaultValidation;

  const specificValidationResult = specificValidation ? specificValidation(question) : true;
  const defaultValidationResult = defaultValidation(question);

  // Return true only if both specific and default validation pass
  return specificValidationResult && defaultValidationResult;
};

export { validateQuestion };

export const isValidUrl = (string: string): boolean => {
  try {
    new URL(string);
    return true;
  } catch (e) {
    return false;
  }
};

// Function to validate question ID and Hidden field Id
export const validateId = (
  type: "Hidden field" | "Question",
  field: string,
  existingQuestionIds: string[],
  existingHiddenFieldIds: string[]
): boolean => {
  if (field.trim() === "") {
    toast.error(`Please enter a ${type} Id.`);
    return false;
  }

  const combinedIds = [...existingQuestionIds, ...existingHiddenFieldIds];

  if (combinedIds.findIndex((id) => id.toLowerCase() === field.toLowerCase()) !== -1) {
    toast.error(`${type} Id already exists in questions or hidden fields.`);
    return false;
  }

  const forbiddenIds = ["userId", "source", "suid", "end", "start", "welcomeCard", "hidden", "verifiedEmail"];
  if (forbiddenIds.includes(field)) {
    toast.error(`${type} Id not allowed.`);
    return false;
  }

  if (field.includes(" ")) {
    toast.error(`${type} Id not allowed, avoid using spaces.`);
    return false;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(field)) {
    toast.error(`${type} Id not allowed, use only alphanumeric characters, hyphens, or underscores.`);
    return false;
  }

  return true;
};
