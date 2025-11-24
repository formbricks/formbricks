import {
  Body,
  Column,
  Container,
  Hr,
  Html,
  Img,
  Link,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import dompurify from "isomorphic-dompurify";
import React from "react";
import { TSurveyFollowUp } from "@formbricks/database/types/survey-follow-up";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { FB_LOGO_URL, IMPRINT_ADDRESS, IMPRINT_URL, PRIVACY_URL } from "@/lib/constants";
import { getQuestionResponseMapping } from "@/lib/responses";
import { parseRecallInfo } from "@/lib/utils/recall";
import { getTranslate } from "@/lingodotdev/server";
import { renderEmailResponseValue } from "@/modules/email/emails/lib/utils";

const fbLogoUrl = FB_LOGO_URL;
const logoLink = "https://formbricks.com?utm_source=email_header&utm_medium=email";

interface FollowUpEmailProps {
  readonly followUp: TSurveyFollowUp;
  readonly logoUrl?: string;
  readonly attachResponseData: boolean;
  readonly includeVariables: boolean;
  readonly includeHiddenFields: boolean;
  readonly survey: TSurvey;
  readonly response: TResponse;
}

export async function FollowUpEmail(props: FollowUpEmailProps): Promise<React.JSX.Element> {
  const { properties } = props.followUp.action;
  let { body } = properties;

  // Parse recall tags and replace with actual response values
  body = parseRecallInfo(body, props.response.data, props.response.variables);

  const questions = props.attachResponseData ? getQuestionResponseMapping(props.survey, props.response) : [];
  const t = await getTranslate();
  // If the logo is not set, we are not using white labeling
  const isDefaultLogo = !props.logoUrl || props.logoUrl === fbLogoUrl;

  return (
    <Html>
      <Tailwind>
        <Body
          className="m-0 h-full w-full justify-center bg-slate-50 p-6 text-center text-slate-800"
          style={{
            fontFamily: "'Jost', 'Helvetica Neue', 'Segoe UI', 'Helvetica', 'sans-serif'",
          }}>
          <Section>
            {isDefaultLogo ? (
              <Link href={logoLink} target="_blank">
                <Img alt="Logo" className="mx-auto w-60" src={fbLogoUrl} />
              </Link>
            ) : (
              <Img alt="Logo" className="mx-auto max-h-[100px] w-60 object-contain" src={props.logoUrl} />
            )}
          </Section>
          <Container className="mx-auto my-8 max-w-xl rounded-md bg-white p-4 text-left text-sm">
            <div
              dangerouslySetInnerHTML={{
                __html: dompurify.sanitize(body, {
                  ALLOWED_TAGS: ["p", "span", "b", "strong", "i", "em", "a", "br"],
                  ALLOWED_ATTR: ["href", "rel", "dir", "class"],
                  ALLOWED_URI_REGEXP: /^https?:\/\//, // Only allow safe URLs starting with http or https
                  ADD_ATTR: ["target"], // Optional: Allow 'target' attribute for links (e.g., _blank)
                }),
              }}
            />

            {questions.length > 0 ? (
              <>
                <Hr />
                <Text className="mb-4 text-base font-semibold text-slate-900">
                  {t("emails.response_data")}
                </Text>
              </>
            ) : null}

            {questions
              .filter(
                (question) =>
                  question.response && !(Array.isArray(question.response) && question.response.length === 0)
              )
              .map((question) => (
                <Row key={question.question}>
                  <Column className="w-full">
                    <Text className="mb-2 text-sm font-semibold text-slate-900">{question.question}</Text>
                    {renderEmailResponseValue(question.response, question.type, t, true)}
                  </Column>
                </Row>
              ))}

            {props.includeVariables &&
              props.survey.variables
                .filter((variable) => {
                  const variableResponse = props.response.variables[variable.id];
                  return variableResponse && ["number", "string"].includes(typeof variableResponse);
                })
                .map((variable) => {
                  const variableResponse = props.response.variables[variable.id];
                  return (
                    <Row key={variable.id}>
                      <Column className="w-full">
                        <Text className="mb-2 text-sm font-semibold text-slate-900">
                          {variable.type === "number"
                            ? `${t("emails.number_variable")}: ${variable.name}`
                            : `${t("emails.text_variable")}: ${variable.name}`}
                        </Text>
                        <Text className="mt-0 whitespace-pre-wrap break-words text-sm text-slate-700">
                          {variableResponse}
                        </Text>
                      </Column>
                    </Row>
                  );
                })}

            {props.includeHiddenFields &&
              props.survey.hiddenFields.fieldIds
                ?.filter((hiddenFieldId) => {
                  const hiddenFieldResponse = props.response.data[hiddenFieldId];
                  return hiddenFieldResponse && typeof hiddenFieldResponse === "string";
                })
                .map((hiddenFieldId) => {
                  const hiddenFieldResponse = props.response.data[hiddenFieldId];
                  return (
                    <Row key={hiddenFieldId}>
                      <Column className="w-full">
                        <Text className="mb-2 text-sm font-semibold text-slate-900">
                          {t("emails.hidden_field")}: {hiddenFieldId}
                        </Text>
                        <Text className="mt-0 whitespace-pre-wrap break-words text-sm text-slate-700">
                          {hiddenFieldResponse}
                        </Text>
                      </Column>
                    </Row>
                  );
                })}
          </Container>

          {/* If the logo is not set, we are not using white labeling */}
          {isDefaultLogo ? (
            <Section className="mt-4 text-center text-sm">
              <Link
                className="m-0 text-sm text-slate-500"
                href="https://formbricks.com/?utm_source=email_header&utm_medium=email"
                target="_blank"
                rel="noopener noreferrer">
                {t("emails.email_template_text_1")}
              </Link>
              {IMPRINT_ADDRESS && (
                <Text className="m-0 text-sm text-slate-500 opacity-50">{IMPRINT_ADDRESS}</Text>
              )}
              {(IMPRINT_URL || PRIVACY_URL) && (
                <Text className="m-0 text-sm text-slate-500 opacity-50">
                  {IMPRINT_URL && (
                    <Link
                      href={IMPRINT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-slate-500">
                      {t("emails.imprint")}
                    </Link>
                  )}
                  {IMPRINT_URL && PRIVACY_URL && " • "}
                  {PRIVACY_URL && (
                    <Link
                      href={PRIVACY_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-slate-500">
                      {t("emails.privacy_policy")}
                    </Link>
                  )}
                </Text>
              )}
            </Section>
          ) : null}
        </Body>
      </Tailwind>
    </Html>
  );
}
