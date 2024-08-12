import { parseRecallInfo } from "@formbricks/lib/utils/recall";
import { TAttributes } from "@formbricks/types/attributes";
import { TSurvey } from "@formbricks/types/surveys/types";

export const replaceAttributeRecall = (survey: TSurvey, attributes: TAttributes): TSurvey => {
  const surveyTemp = structuredClone(survey);
  const languages = Object.keys(survey.questions[0].headline);
  surveyTemp.questions.forEach((question) => {
    languages.forEach((language) => {
      if (question.headline[language].includes("recall:")) {
        question.headline[language] = parseRecallInfo(question.headline[language], attributes);
      }
      if (question.subheader && question.subheader[language].includes("recall:")) {
        question.subheader[language] = parseRecallInfo(question.subheader[language], attributes);
      }
    });
  });
  if (surveyTemp.welcomeCard.enabled && surveyTemp.welcomeCard.headline) {
    languages.forEach((language) => {
      if (surveyTemp.welcomeCard.headline && surveyTemp.welcomeCard.headline[language].includes("recall:")) {
        surveyTemp.welcomeCard.headline[language] = parseRecallInfo(
          surveyTemp.welcomeCard.headline[language],
          attributes
        );
      }
    });
  }
  surveyTemp.endings.forEach((ending) => {
    if (ending.type === "endScreen") {
      languages.forEach((language) => {
        if (ending.headline && ending.headline[language].includes("recall:")) {
          ending.headline[language] = parseRecallInfo(ending.headline[language], attributes);
          if (ending.subheader && ending.subheader[language].includes("recall:")) {
            ending.subheader[language] = parseRecallInfo(ending.subheader[language], attributes);
          }
        }
      });
    }
  });

  return surveyTemp;
};

export const replaceAttributeRecallInLegacySurveys = (survey: any, attributes: TAttributes): any => {
  const surveyTemp = structuredClone(survey);
  surveyTemp.questions.forEach((question) => {
    if (question.headline.includes("recall:")) {
      question.headline = parseRecallInfo(question.headline, attributes);
    }
    if (question.subheader && question.subheader.includes("recall:")) {
      question.subheader = parseRecallInfo(question.subheader, attributes);
    }
  });
  if (surveyTemp.welcomeCard.enabled && surveyTemp.welcomeCard.headline) {
    if (surveyTemp.welcomeCard.headline && surveyTemp.welcomeCard.headline.includes("recall:")) {
      surveyTemp.welcomeCard.headline = parseRecallInfo(surveyTemp.welcomeCard.headline, attributes);
    }
  }
  if (surveyTemp.thankYouCard.enabled && surveyTemp.thankYouCard.headline) {
    if (surveyTemp.thankYouCard.headline && surveyTemp.thankYouCard.headline.includes("recall:")) {
      surveyTemp.thankYouCard.headline = parseRecallInfo(surveyTemp.thankYouCard.headline, attributes);
      if (surveyTemp.thankYouCard.subheader && surveyTemp.thankYouCard.subheader.includes("recall:")) {
        surveyTemp.thankYouCard.subheader = parseRecallInfo(surveyTemp.thankYouCard.subheader, attributes);
      }
    }
  }
  return surveyTemp;
};
