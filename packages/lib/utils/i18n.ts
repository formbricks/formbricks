import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyQuestion, TSurvey } from "@formbricks/types/surveys";
// Helper function to create an i18nString from a regular string.
// languages = ["german","hindi"]
const createI18nString = (text: string | TI18nString, languages?: string[]): TI18nString => {
  // Check if text is already an i18nString
  if (typeof text === "object" && text._i18n_ === true) {
    const i18nString: TI18nString = { ...text };

    // Add new language keys with empty strings if they don't exist
    languages?.forEach((language) => {
      if (!i18nString.hasOwnProperty(language)) {
        i18nString[language] = "";
      }
    });

    // Remove language keys that are not in the languages array
    Object.keys(i18nString).forEach((key) => {
      if (key !== "_i18n_" && key !== "en" && languages && !languages.includes(key)) {
        delete i18nString[key];
      }
    });

    return i18nString;
  } else {
    // It's a regular string, so create a new i18n object
    const i18nString: TI18nString = {
      _i18n_: true,
      en: text, // Assuming 'en' is your default language
    };

    // Initialize all provided languages with empty strings
    languages?.forEach((language) => {
      if (language !== "en") {
        i18nString[language] = "";
      }
    });

    return i18nString;
  }
};

// Function to translate a choice label
const translateChoice = (choice: any, languages?: string) => {
  // Assuming choice is a simple object and choice.label is a string.
  return {
    ...choice,
    label: createI18nString(choice.label, languages),
  };
};

// Function that will translate a single question
export const translateQuestion = (question: TSurveyQuestion, languages: string[]) => {
  // Clone the question to avoid mutating the original
  const clonedQuestion = { ...question };

  // Translate headline and subheader
  clonedQuestion.headline = createI18nString(question.headline, languages);
  clonedQuestion.subheader = createI18nString(question.subheader, languages);

  if (question.type === "multipleChoiceSingle" || question.type === "multipleChoiceMulti") {
    // Make sure to create a deep copy of the choices to avoid any reference issues
    clonedQuestion.choices = question.choices.map((choice) => translateChoice({ ...choice }, languages));
  }

  return clonedQuestion;
};

// Function to translate an entire survey
export const translateSurvey = (survey: TSurvey, languages?: string[]): TSurvey => {
  const translatedQuestions = survey.questions.map((question) => {
    return translateQuestion(question, languages); // Added return here
  });
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

export function convertArrayToObject(array2D: string[][]) {
  return array2D.reduce((obj, item) => {
    if (item.length >= 2) {
      const [key, value] = item;
      obj[key] = value;
    }
    return obj;
  }, {});
}
