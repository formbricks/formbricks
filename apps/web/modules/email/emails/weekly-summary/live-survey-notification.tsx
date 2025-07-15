import { WEBAPP_URL } from "@/lib/constants";
import { renderEmailResponseValue } from "@/modules/email/emails/lib/utils";
import { getTranslate } from "@/tolgee/server";
import { Container, Hr, Link, Tailwind, Text } from "@react-email/components";
import { TFnType } from "@tolgee/react";
import React, { type JSX } from "react";
import type { TSurveyStatus } from "@formbricks/types/surveys/types";
import type {
  TWeeklySummaryNotificationDataSurvey,
  TWeeklySummarySurveyResponseData,
} from "@formbricks/types/weekly-summary";
import { EmailButton } from "../../components/email-button";

const getButtonLabel = (count: number, t: TFnType): string => {
  if (count === 1) {
    return t("emails.live_survey_notification_view_response");
  }
  return t("emails.live_survey_notification_view_more_responses", {
    responseCount: count > 2 ? (count - 1).toString() : "1",
  });
};

const convertSurveyStatus = (status: TSurveyStatus, t: TFnType): string => {
  const statusMap = {
    inProgress: t("emails.live_survey_notification_in_progress"),
    paused: t("emails.live_survey_notification_paused"),
    completed: t("emails.live_survey_notification_completed"),
    draft: t("emails.live_survey_notification_draft"),
    scheduled: t("emails.live_survey_notification_scheduled"),
  };

  return statusMap[status] || status;
};

interface LiveSurveyNotificationProps {
  environmentId: string;
  surveys: TWeeklySummaryNotificationDataSurvey[];
}

export async function LiveSurveyNotification({
  environmentId,
  surveys,
}: LiveSurveyNotificationProps): Promise<React.JSX.Element[]> {
  const t = await getTranslate();
  const createSurveyFields = (
    surveyResponses: TWeeklySummarySurveyResponseData[]
  ): React.JSX.Element | React.JSX.Element[] => {
    if (surveyResponses.length === 0) {
      return (
        <Container className="mt-4">
          <Text className="m-0 text-sm font-medium">
            {t("emails.live_survey_notification_no_responses_yet")}
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
          <Text className="m-0 text-sm">{surveyResponse.headline}</Text>
          {renderEmailResponseValue(surveyResponse.responseValue, surveyResponse.questionType, t)}
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
    const displayStatus = convertSurveyStatus(survey.status, t);
    const isInProgress = displayStatus === "In Progress";
    const noResponseLastWeek = isInProgress && survey.responses.length === 0;
    return (
      <Tailwind key={survey.id}>
        <Container className="mt-12">
          <Text className="mb-0 inline">
            <Link
              className="text-sm text-black underline"
              href={`${WEBAPP_URL}/environments/${environmentId}/surveys/${survey.id}/responses?utm_source=weekly&utm_medium=email&utm_content=ViewResponsesCTA`}>
              {survey.name}
            </Link>
          </Text>

          <Text
            className={`ml-2 inline ${isInProgress ? "bg-green-400 text-slate-100" : "bg-slate-300 text-blue-800"} rounded-full px-2 py-1 text-sm`}>
            {displayStatus}
          </Text>
          {noResponseLastWeek ? (
            <Text className="text-sm">{t("emails.live_survey_notification_no_new_response")}</Text>
          ) : (
            createSurveyFields(survey.responses)
          )}
          {survey.responseCount > 0 && (
            <Container className="mt-4 block text-sm">
              <EmailButton
                href={`${WEBAPP_URL}/environments/${environmentId}/surveys/${survey.id}/responses?utm_source=weekly&utm_medium=email&utm_content=ViewResponsesCTA`}
                label={
                  noResponseLastWeek
                    ? t("emails.live_survey_notification_view_previous_responses")
                    : getButtonLabel(survey.responseCount, t)
                }
              />
            </Container>
          )}
        </Container>
      </Tailwind>
    );
  });
}
