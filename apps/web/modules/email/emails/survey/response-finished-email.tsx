import { getQuestionResponseMapping } from "@/lib/responses";
import { renderEmailResponseValue } from "@/modules/email/emails/lib/utils";
import { getTranslate } from "@/tolgee/server";
import { Column, Container, Hr, Link, Row, Section, Text } from "@react-email/components";
import { FileDigitIcon, FileType2Icon } from "lucide-react";
import type { TOrganization } from "@formbricks/types/organizations";
import type { TResponse } from "@formbricks/types/responses";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { EmailButton } from "../../components/email-button";
import { EmailTemplate } from "../../components/email-template";

interface ResponseFinishedEmailProps {
  survey: TSurvey;
  responseCount: number;
  response: TResponse;
  WEBAPP_URL: string;
  environmentId: string;
  organization: TOrganization;
}

export async function ResponseFinishedEmail({
  survey,
  responseCount,
  response,
  WEBAPP_URL,
  environmentId,
  organization,
}: ResponseFinishedEmailProps): Promise<React.JSX.Element> {
  const questions = getQuestionResponseMapping(survey, response);
  const t = await getTranslate();

  return (
    <EmailTemplate t={t}>
      <Container>
        <Row>
          <Column>
            <Text className="mb-4 text-xl font-bold"> {t("emails.survey_response_finished_email_hey")}</Text>
            <Text className="mb-4 font-normal">
              {t("emails.survey_response_finished_email_congrats", {
                surveyName: survey.name,
              })}
            </Text>
            <Hr />
            {questions.map((question) => {
              if (!question.response) return;
              return (
                <Row key={question.question}>
                  <Column className="w-full">
                    <Text className="mb-2 font-medium">{question.question}</Text>
                    {renderEmailResponseValue(question.response, question.type, t)}
                  </Column>
                </Row>
              );
            })}
            {survey.variables.map((variable) => {
              const variableResponse = response.variables[variable.id];
              if (variableResponse && ["number", "string"].includes(typeof variable)) {
                return (
                  <Row key={variable.id}>
                    <Column className="w-full">
                      <Text className="mb-2 flex items-center gap-2 font-medium">
                        {variable.type === "number" ? (
                          <FileDigitIcon className="h-4 w-4" />
                        ) : (
                          <FileType2Icon className="h-4 w-4" />
                        )}
                        {variable.name}
                      </Text>
                      <Text className="mt-0 font-bold break-words whitespace-pre-wrap">
                        {variableResponse}
                      </Text>
                    </Column>
                  </Row>
                );
              }
              return null;
            })}
            {survey.hiddenFields.fieldIds?.map((hiddenFieldId) => {
              const hiddenFieldResponse = response.data[hiddenFieldId];
              if (hiddenFieldResponse && typeof hiddenFieldResponse === "string") {
                return (
                  <Row key={hiddenFieldId}>
                    <Column className="w-full">
                      <Text className="mb-2 flex items-center gap-2 font-medium">
                        {hiddenFieldId} <EyeOffIcon />
                      </Text>
                      <Text className="mt-0 font-bold break-words whitespace-pre-wrap">
                        {hiddenFieldResponse}
                      </Text>
                    </Column>
                  </Row>
                );
              }
              return null;
            })}
            <EmailButton
              href={`${WEBAPP_URL}/environments/${environmentId}/surveys/${survey.id}/responses?utm_source=email_notification&utm_medium=email&utm_content=view_responses_CTA`}
              label={
                responseCount > 1
                  ? t("emails.survey_response_finished_email_view_more_responses", {
                      responseCount: String(responseCount - 1),
                    })
                  : t("emails.survey_response_finished_email_view_survey_summary")
              }
            />
            <Hr />
            <Section className="mt-4 text-center text-sm">
              <Text className="font-bold">
                {t("emails.survey_response_finished_email_dont_want_notifications")}
              </Text>
              <Text className="mb-0">
                <Link
                  className="text-black underline"
                  href={`${WEBAPP_URL}/environments/${environmentId}/settings/notifications?type=alert&elementId=${survey.id}`}>
                  {t("emails.survey_response_finished_email_turn_off_notifications_for_this_form")}
                </Link>
              </Text>
              <Text className="mt-0">
                <Link
                  className="text-black underline"
                  href={`${WEBAPP_URL}/environments/${environmentId}/settings/notifications?type=unsubscribedOrganizationIds&elementId=${organization.id}`}>
                  {t("emails.survey_response_finished_email_turn_off_notifications_for_all_new_forms")}
                </Link>
              </Text>
            </Section>
          </Column>
        </Row>
      </Container>
    </EmailTemplate>
  );
}

function EyeOffIcon(): React.JSX.Element {
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
      className="lucide lucide-eye-off h-4 w-4 rounded-lg bg-slate-200 p-1">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}
