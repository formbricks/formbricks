// extend this object in order to add more validation rules

import {
  MultipleChoiceMultiQuestion,
  MultipleChoiceSingleQuestion,
  Question,
} from "@formbricks/types/questions";

const validationRules = {
  multipleChoiceMulti: (question: MultipleChoiceMultiQuestion) => {
    return !question.choices.some((element) => element.label.trim() === "");
  },
  multipleChoiceSingle: (question: MultipleChoiceSingleQuestion) => {
    return !question.choices.some((element) => element.label.trim() === "");
  },
  defaultValidation: (question: Question) => {
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
