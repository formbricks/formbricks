// extend this object in order to add more validation rules
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
