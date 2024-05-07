import { Column, Container, Hr, Img, Link, Row, Section, Text } from "@react-email/components";
import React from "react";

import { getQuestionResponseMapping } from "@formbricks/lib/responses";
import { getOriginalFileNameFromUrl } from "@formbricks/lib/storage/utils";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestionType } from "@formbricks/types/surveys";
import { TTeam } from "@formbricks/types/teams";

import { EmailButton } from "../general/EmailButton";

export const renderEmailResponseValue = (response: string | string[], questionType: string) => {
  switch (questionType) {
    case TSurveyQuestionType.FileUpload:
      return (
        <Container>
          {typeof response !== "string" &&
            response.map((response) => (
              <Link
                href={response}
                key={response}
                className="mt-2 flex flex-col items-center justify-center rounded-lg bg-gray-200 p-2 text-black shadow-sm">
                <FileIcon />
                <Text className="mx-auto mb-0 truncate">{getOriginalFileNameFromUrl(response)}</Text>
              </Link>
            ))}
        </Container>
      );
    case TSurveyQuestionType.PictureSelection:
      return (
        <Container className="flex">
          <Row>
            {typeof response !== "string" &&
              response.map((response) => (
                <Column>
                  <Img src={response} id={response} alt={response.split("/").pop()} className="m-2 h-28" />
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
  team: TTeam | null;
}

export const ResponseFinishedEmail = ({
  survey,
  responseCount,
  response,
  WEBAPP_URL,
  environmentId,
  team,
}: ResponseFinishedEmailProps) => {
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
                href={`${WEBAPP_URL}/environments/${environmentId}/settings/notifications?type=unsubscribedTeamIds&elementId=${team?.id}`}>
                all newly created forms{" "}
              </Link>
            </Text>
          </Section>
        </Column>
      </Row>
    </Container>
  );
};

const FileIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-file">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
};
