import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { generateSurveySingleUseId } from "@/app/lib/singleUseSurveys";

import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getSurveys } from "@formbricks/lib/survey/service";
import { DatabaseError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys";

function calculateElementIdx(survey: TSurvey, currentQustionIdx: number): number {
  const currentQuestion = survey.questions[currentQustionIdx];
  const surveyLength = survey.questions.length;
  const middleIdx = Math.floor(surveyLength / 2);
  const possibleNextQuestions = currentQuestion?.logic?.map((l) => l.destination) || [];

  const getLastQuestionIndex = () => {
    const lastQuestion = survey.questions
      .filter((q) => possibleNextQuestions.includes(q.id))
      .sort((a, b) => survey.questions.indexOf(a) - survey.questions.indexOf(b))
      .pop();
    return survey.questions.findIndex((e) => e.id === lastQuestion?.id);
  };

  let elementIdx = currentQustionIdx || 0.5;
  const lastprevQuestionIdx = getLastQuestionIndex();

  if (lastprevQuestionIdx > 0) elementIdx = Math.min(middleIdx, lastprevQuestionIdx - 1);
  if (possibleNextQuestions.includes("end")) elementIdx = middleIdx;
  return elementIdx;
}

function calculateTimeToComplete(survey: TSurvey): number {
  let idx = calculateElementIdx(survey, 0);
  if (idx === 0.5) {
    idx = 1;
  }
  const timeInSeconds = (survey.questions.length / idx) * 15; //15 seconds per question.

  // Calculate minutes, if there are any seconds left, add a minute
  const minutes = Math.floor(timeInSeconds / 60);
  const remainingSeconds = timeInSeconds % 60;

  if (remainingSeconds > 0) {
    // If there are any seconds left, we'll need to round up to the next minute
    if (minutes === 0) {
      // If less than 1 minute, return 'less than 1 minute'
      return 1;
    } else {
      // If more than 1 minute, return 'less than X minutes', where X is minutes + 1
      return minutes + 1;
    }
  }

  return minutes;
}

export async function GET(request: Request) {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const surveys = await getSurveys(authentication.environmentId!);

    const { searchParams } = new URL(request.url);

    if (!searchParams.has("country")) {
      return responses.validationResponse({ country: "required" });
    } else if (!searchParams.has("panelist_id")) {
      return responses.validationResponse({ panelist_id: "required" });
    } else if (!searchParams.has("language")) {
      return responses.validationResponse({ language: "required" });
    } else if (!searchParams.has("email")) {
      return responses.validationResponse({ email: "required" });
    }

    //TODO FILTER surveys if panelist already completed
    const activeSurveys = surveys
      .filter((survey) => {
        return survey.status === "inProgress" && survey.type === "link";
      })
      .filter((survey) => {
        if (survey.countries.length > 0) {
          const found = survey.countries.find((country) => {
            return country.isoCode === searchParams.get("country");
          });

          //If panelist doesn't belong to survey country, then skip it.
          if (!found) return false;
        }

        const requestedLanguage = searchParams.get("language");
        if (requestedLanguage == "en" && survey.languages.length === 0) {
          return true;
        }
        return survey.languages.some((lang) => {
          return lang.language.code === requestedLanguage && lang.enabled;
        });
      })
      .map((survey) => {
        let url = WEBAPP_URL + "/s/" + survey.id;
        if (survey.singleUse?.enabled) {
          const singleUseId = generateSurveySingleUseId(survey.singleUse.isEncrypted);
          url += `?suId=${singleUseId}`;
          url += `&email=${encodeURIComponent(searchParams.get("email") ?? "")}`;
          url += `&userId=${searchParams.get("panelist_id")}`;
          url += `&country=${searchParams.get("country")}`;
          url += `&lang=${searchParams.get("language")}`;
          url += `&source=[SOURCE]`;
        }

        return {
          id: survey.id,
          name: survey.name,
          created_at: survey.createdAt,
          updated_at: survey.updatedAt,
          reward: survey.reward,
          survey_url: url,
          loi: calculateTimeToComplete(survey),
          country: survey.countries.reduce((acc, country) => {
            acc[country.isoCode] = country.name;

            return acc;
          }, {}),
        };
      });

    return responses.successResponse(activeSurveys);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
}
