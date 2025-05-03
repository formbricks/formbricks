import { parseRecallInfo } from "@/lib/utils/recall";
import { TAttributes } from "@formbricks/types/attributes";
import { TSurvey } from "@formbricks/types/surveys/types";

export const replaceAttributeRecall = (survey: TSurvey, attributes: TAttributes): TSurvey => {
  const surveyTemp = structuredClone(survey);
  const languages = surveyTemp.languages
    .map((surveyLanguage) => {
      if (surveyLanguage.default) {
        return "default";
      }

      if (surveyLanguage.enabled) {
        return surveyLanguage.language.code;
      }

      return null;
    })
    .filter((language): language is string => language !== null);

  surveyTemp.questions.forEach((question) => {
    languages.forEach((language) => {
      if (question.headline[language]?.includes("recall:")) {
        question.headline[language] = parseRecallInfo(question.headline[language], attributes);
      }
      if (question.subheader && question.subheader[language]?.includes("recall:")) {
        question.subheader[language] = parseRecallInfo(question.subheader[language], attributes);
      }
    });
  });
  if (surveyTemp.welcomeCard.enabled && surveyTemp.welcomeCard.headline) {
    languages.forEach((language) => {
      if (surveyTemp.welcomeCard.headline && surveyTemp.welcomeCard.headline[language]?.includes("recall:")) {
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
        if (ending.headline && ending.headline[language]?.includes("recall:")) {
          ending.headline[language] = parseRecallInfo(ending.headline[language], attributes);
          if (ending.subheader && ending.subheader[language]?.includes("recall:")) {
            ending.subheader[language] = parseRecallInfo(ending.subheader[language], attributes);
          }
        }
      });
    }
  });

  return surveyTemp;
};
