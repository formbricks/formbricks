import { Column, Container, Hr, Img, Link, Row, Section, Text } from "@react-email/components";
import { getQuestionResponseMapping } from "@formbricks/lib/responses";
import { getOriginalFileNameFromUrl } from "@formbricks/lib/storage/utils";
import type { TOrganization } from "@formbricks/types/organizations";
import type { TResponse } from "@formbricks/types/responses";
import type { TSurvey, TSurveyQuestionType } from "@formbricks/types/surveys";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys";
import { EmailButton } from "../general/email-button";

export const renderEmailResponseValue = (response: string | string[], questionType: TSurveyQuestionType) => {
  switch (questionType) {
    case TSurveyQuestionTypeEnum.FileUpload:
      return (
        <Container>
          {typeof response !== "string" &&
            response.map((responseItem) => (
              <Link
                className="mt-2 flex flex-col items-center justify-center rounded-lg bg-gray-200 p-2 text-black shadow-sm"
                href={responseItem}
                key={responseItem}>
                <FileIcon />
                <Text className="mx-auto mb-0 truncate">{getOriginalFileNameFromUrl(responseItem)}</Text>
              </Link>
            ))}
        </Container>
      );
    case TSurveyQuestionTypeEnum.PictureSelection:
      return (
        <Container className="flex">
          <Row>
            {typeof response !== "string" &&
              response.map((responseItem) => (
                <Column key={responseItem}>
                  <Img
                    alt={responseItem.split("/").pop()}
                    className="m-2 h-28"
                    id={responseItem}
                    src={responseItem}
                  />
                </Column>
              ))}
          </Row>
        </Container>
      );

    default:
      return <Text className="mt-0 whitespace-pre-wrap break-words font-bold">{response}</Text>;
  }
};

interface ResponseFinishedEmailProps {
  survey: TSurvey;
  responseCount: number;
  response: TResponse;
  WEBAPP_URL: string;
  environmentId: string;
  organization: TOrganization | null;
}

export function ResponseFinishedEmail({
  survey,
  responseCount,
  response,
  WEBAPP_URL,
  environmentId,
  organization,
}: ResponseFinishedEmailProps) {
  const questions = getQuestionResponseMapping(survey, response);

  return (
    <Container>
      <Row>
        <Column>
          <Text className="mb-4 text-3xl font-bold">Hey 👋</Text>
          <Text className="mb-4">
            Congrats, you received a new response to your survey! Someone just completed your survey{" "}
            <strong>{survey.name}</strong>:
          </Text>
          <Hr />
          {questions.map((question) => {
            if (!question.response) return;
            return (
              <Row key={question.question}>
                <Column className="w-full">
                  <Text className="mb-2 font-medium">{question.question}</Text>
                  {renderEmailResponseValue(question.response, question.type)}
                </Column>
              </Row>
            );
          })}
          <EmailButton
            href={`${WEBAPP_URL}/environments/${environmentId}/surveys/${survey.id}/responses?utm_source=email_notification&utm_medium=email&utm_content=view_responses_CTA`}
            label={
              responseCount > 1
                ? `View ${responseCount - 1} more ${responseCount === 2 ? "response" : "responses"}`
                : `View survey summary`
            }
          />
          <Hr />
          <Section className="mt-4 text-center text-sm">
            <Text className="font-bold">Don&apos;t want to get these notifications?</Text>
            <Text className="mb-0">
              Turn off notifications for{" "}
              <Link
                className="text-black underline"
                href={`${WEBAPP_URL}/environments/${environmentId}/settings/notifications?type=alert&elementId=${survey.id}`}>
                this form
              </Link>
            </Text>
            <Text className="mt-0">
              Turn off notifications for{" "}
              <Link
                className="text-black underline"
                href={`${WEBAPP_URL}/environments/${environmentId}/settings/notifications?type=unsubscribedOrganizationIds&elementId=${organization?.id}`}>
                all newly created forms{" "}
              </Link>
            </Text>
          </Section>
        </Column>
      </Row>
    </Container>
  );
}

function FileIcon() {
  return (
    <svg
      className="lucide lucide-file"
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}
