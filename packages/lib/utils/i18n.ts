import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyChoice, TSurveyQuestion, TSurvey } from "@formbricks/types/surveys";
// Helper function to create an i18nString from a regular string.
const createI18nString = (text: string): TI18nString => {
  return {
    _i18n_: true,
    default: text, // Assuming 'en' is your default language
    german: "",
    hindi: "",
  };
};

// Function to translate a choice label
const translateChoice = (choice) => {
  // Assuming choice is a simple object and choice.label is a string.
  return {
    ...choice,
    label: createI18nString(choice.label),
  };
};

// Function that will translate a single question
export const translateQuestion = (question) => {
  // Clone the question to avoid mutating the original
  const clonedQuestion = { ...question };

  // Translate headline and subheader
  clonedQuestion.headline = createI18nString(question.headline);
  clonedQuestion.subheader = createI18nString(question.subheader);

  if (question.type === "multipleChoiceSingle" || question.type === "multipleChoiceMulti") {
    // Make sure to create a deep copy of the choices to avoid any reference issues
    clonedQuestion.choices = question.choices.map((choice) => translateChoice({ ...choice }));
  }
  console.log(clonedQuestion);

  return clonedQuestion;
};

// Function to translate an entire survey
export const translateSurvey = (survey: TSurvey): TSurvey => {
  // Mapping over each question to translate it
  const translatedQuestions = survey.questions.map(translateQuestion);
  console.log(translatedQuestions);
  // Returning a new survey object with the translated questions
  const translatedSurvey = { ...survey };
  return {
    ...translatedSurvey,
    questions: translatedQuestions,
  };
};
// Function to retrieve the correct translation from an i18nObject
export const getTranslation = (i18nObject: TI18nString, languageCode: string): string => {
  // If the specific language translation exists, return it
  if (i18nObject[languageCode]) {
    return i18nObject[languageCode];
  }
  // If not, return the English version or a default fallback
  return i18nObject.en || "Translation not available";
};
