import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { convertResponseValue } from "@formbricks/lib/responses";
import { replaceHeadlineRecall } from "@formbricks/lib/utils/recall";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  TWeeklyEmailResponseData,
  TWeeklySummaryEnvironmentData,
  TWeeklySummaryNotificationDataSurvey,
  TWeeklySummaryNotificationResponse,
  TWeeklySummarySurveyResponseData,
} from "@formbricks/types/weekly-summary";

export const getNotificationResponse = (
  environment: TWeeklySummaryEnvironmentData,
  projectName: string
): TWeeklySummaryNotificationResponse => {
  const insights = {
    totalCompletedResponses: 0,
    totalDisplays: 0,
    totalResponses: 0,
    completionRate: 0,
    numLiveSurvey: 0,
  };

  const surveys: TWeeklySummaryNotificationDataSurvey[] = [];
  // iterate through the surveys and calculate the overall insights
  for (const survey of environment.surveys) {
    const parsedSurvey = replaceHeadlineRecall(survey as unknown as TSurvey, "default") as TSurvey & {
      responses: TWeeklyEmailResponseData[];
    };
    const surveyData: TWeeklySummaryNotificationDataSurvey = {
      id: parsedSurvey.id,
      name: parsedSurvey.name,
      status: parsedSurvey.status,
      responseCount: parsedSurvey.responses.length,
      responses: [],
    };
    // iterate through the responses and calculate the survey insights
    for (const response of parsedSurvey.responses) {
      // only take the first 3 responses
      if (surveyData.responses.length >= 3) {
        break;
      }
      const surveyResponses: TWeeklySummarySurveyResponseData[] = [];
      for (const question of parsedSurvey.questions) {
        const headline = question.headline;
        const responseValue = convertResponseValue(response.data[question.id], question);
        const surveyResponse: TWeeklySummarySurveyResponseData = {
          headline: getLocalizedValue(headline, "default"),
          responseValue,
          questionType: question.type,
        };
        surveyResponses.push(surveyResponse);
      }
      surveyData.responses = surveyResponses;
    }
    surveys.push(surveyData);
    // calculate the overall insights
    if (survey.status == "inProgress") {
      insights.numLiveSurvey += 1;
    }
    insights.totalCompletedResponses += survey.responses.filter((r) => r.finished).length;
    insights.totalDisplays += survey.displays.length;
    insights.totalResponses += survey.responses.length;
    insights.completionRate = Math.round((insights.totalCompletedResponses / insights.totalResponses) * 100);
  }
  // build the notification response needed for the emails
  const lastWeekDate = new Date();
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  return {
    environmentId: environment.id,
    currentDate: new Date(),
    lastWeekDate,
    projectName: projectName,
    surveys,
    insights,
  };
};
