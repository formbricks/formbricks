import { Container, Hr, Link, Tailwind, Text } from "@react-email/components";
import React from "react";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import type { TSurveyStatus } from "@formbricks/types/surveys/types";
import type {
  TWeeklySummaryNotificationDataSurvey,
  TWeeklySummarySurveyResponseData,
} from "@formbricks/types/weekly-summary";
import { EmailButton } from "../../components/email-button";
import { translateEmailText } from "../../lib/utils";
import { renderEmailResponseValue } from "../survey/response-finished-email";

const getButtonLabel = (count: number, locale: string): string => {
  if (count === 1) {
    return translateEmailText("live_survey_notification_view_response", locale);
  }
  return translateEmailText("live_survey_notification_view_more_responses", locale, {
    responseCount: count > 2 ? (count - 1).toString() : "1",
  });
};

const convertSurveyStatus = (status: TSurveyStatus, locale: string): string => {
  const statusMap = {
    inProgress: translateEmailText("live_survey_notification_in_progress", locale),
    paused: translateEmailText("live_survey_notification_paused", locale),
    completed: translateEmailText("live_survey_notification_completed", locale),
    draft: translateEmailText("live_survey_notification_draft", locale),
    scheduled: translateEmailText("live_survey_notification_scheduled", locale),
  };

  return statusMap[status] || status;
};

interface LiveSurveyNotificationProps {
  environmentId: string;
  surveys: TWeeklySummaryNotificationDataSurvey[];
  locale: string;
}

export const LiveSurveyNotification = ({
  environmentId,
  surveys,
  locale,
}: LiveSurveyNotificationProps): React.JSX.Element[] => {
  const createSurveyFields = (
    surveyResponses: TWeeklySummarySurveyResponseData[]
  ): React.JSX.Element | React.JSX.Element[] => {
    if (surveyResponses.length === 0) {
      return (
        <Container className="mt-4">
          <Text className="m-0 font-bold">
            {translateEmailText("live_survey_notification_no_responses_yet", locale)}
          </Text>
        </Container>
      );
    }
    const surveyFields: JSX.Element[] = [];
    const responseCount = surveyResponses.length;

    surveyResponses.forEach((surveyResponse, index) => {
      if (!surveyResponse.responseValue) {
        return;
      }

      surveyFields.push(
        <Container className="mt-4" key={`${index.toString()}-${surveyResponse.headline}`}>
          <Text className="m-0">{surveyResponse.headline}</Text>
          {renderEmailResponseValue(surveyResponse.responseValue, surveyResponse.questionType)}
        </Container>
      );

      // Add <hr/> only when there are 2 or more responses to display, and it's not the last response
      if (responseCount >= 2 && index < responseCount - 1) {
        surveyFields.push(<Hr key={`hr-${index.toString()}`} />);
      }
    });

    return surveyFields;
  };

  if (!surveys.length) return [];

  return surveys.map((survey) => {
    const displayStatus = convertSurveyStatus(survey.status, locale);
    const isInProgress = displayStatus === "In Progress";
    const noResponseLastWeek = isInProgress && survey.responses.length === 0;
    return (
      <Tailwind key={survey.id}>
        <Container className="mt-12">
          <Text className="mb-0 inline">
            <Link
              className="text-xl text-black underline"
              href={`${WEBAPP_URL}/environments/${environmentId}/surveys/${survey.id}/responses?utm_source=weekly&utm_medium=email&utm_content=ViewResponsesCTA`}>
              {survey.name}
            </Link>
          </Text>

          <Text
            className={`ml-2 inline ${isInProgress ? "bg-green-400 text-slate-100" : "bg-slate-300 text-blue-800"} rounded-full px-2 py-1 text-sm`}>
            {displayStatus}
          </Text>
          {noResponseLastWeek ? (
            <Text>{translateEmailText("live_survey_notification_no_new_response", locale)}</Text>
          ) : (
            createSurveyFields(survey.responses)
          )}
          {survey.responseCount > 0 && (
            <Container className="mt-4 block">
              <EmailButton
                href={`${WEBAPP_URL}/environments/${environmentId}/surveys/${survey.id}/responses?utm_source=weekly&utm_medium=email&utm_content=ViewResponsesCTA`}
                label={
                  noResponseLastWeek
                    ? translateEmailText("live_survey_notification_view_previous_responses", locale)
                    : getButtonLabel(survey.responseCount, locale)
                }
              />
            </Container>
          )}
        </Container>
      </Tailwind>
    );
  });
};
