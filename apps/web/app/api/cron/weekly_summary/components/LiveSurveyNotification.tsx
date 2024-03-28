import { TNotificationDataSurvey, TSurveyResponse } from "@/app/api/cron/weekly_summary/types";
import { Container, Hr, Link, Tailwind, Text } from "@react-email/components";

import { EmailButton } from "@formbricks/lib/emails/EmailButton";

const getButtonLabel = (count: number): string => {
  if (count === 1) {
    return "View Response";
  }
  return `View ${count > 2 ? count - 1 : "1"} more Response${count > 2 ? "s" : ""}`;
};

const convertSurveyStatus = (status: string): string => {
  const statusMap = {
    inProgress: "Live",
    paused: "Paused",
    completed: "Completed",
  };

  return statusMap[status] || status;
};

interface LiveSurveyNotificationProps {
  WEBAPP_URL: string;
  environmentId: string;
  surveys: TNotificationDataSurvey[];
}

export const LiveSurveyNotification = ({
  WEBAPP_URL,
  environmentId,
  surveys,
}: LiveSurveyNotificationProps) => {
  const createSurveyFields = (surveyResponses: TSurveyResponse[]) => {
    if (surveyResponses.length === 0) {
      return (
        <Container className="mt-4">
          <Text className="m-0 font-bold">No Responses yet!</Text>
        </Container>
      );
    }
    let surveyFields: JSX.Element[] = [];
    const responseCount = surveyResponses.length;

    surveyResponses.forEach((response, index) => {
      if (!response) {
        return;
      }

      for (const [headline, answer] of Object.entries(response)) {
        surveyFields.push(
          <Container className="mt-4" key={`${index}-${headline}`}>
            <Text className="m-0">{headline}</Text>
            <Text className="m-0 font-bold">{answer.toString()}</Text>
          </Container>
        );
      }

      // Add <hr/> only when there are 2 or more responses to display, and it's not the last response
      if (responseCount >= 2 && index < responseCount - 1) {
        surveyFields.push(<Hr key={`hr-${index}`} />);
      }
    });

    return surveyFields;
  };

  if (!surveys.length) return ` `;

  return surveys.map((survey) => {
    const displayStatus = convertSurveyStatus(survey.status);
    const isLive = displayStatus === "Live";
    const noResponseLastWeek = isLive && survey.responses.length === 0;
    return (
      <Tailwind>
        <Container className="mt-12">
          <Text className="mb-0 inline">
            <Link
              href={`${WEBAPP_URL}/environments/${environmentId}/surveys/${survey.id}/responses?utm_source=weekly&utm_medium=email&utm_content=ViewResponsesCTA`}
              className="text-xl text-black underline">
              {survey.name}
            </Link>
          </Text>

          <Text
            className={`ml-2 inline ${isLive ? "bg-green-400" : "bg-gray-300"} ${isLive ? "text-gray-100" : "text-blue-800"} rounded-full px-2 py-1 text-sm`}>
            {displayStatus}
          </Text>
          {noResponseLastWeek ? (
            <Text>No new response received this week 🕵️</Text>
          ) : (
            createSurveyFields(survey.responses)
          )}
          {survey.responseCount > 0 && (
            <Container className="mt-4 block">
              <EmailButton
                label={noResponseLastWeek ? "View previous responses" : getButtonLabel(survey.responseCount)}
                href={`${WEBAPP_URL}/environments/${environmentId}/surveys/${survey.id}/responses?utm_source=weekly&utm_medium=email&utm_content=ViewResponsesCTA`}
              />
            </Container>
          )}
        </Container>
      </Tailwind>
    );
  });
};
