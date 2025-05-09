import { FB_LOGO_URL, IMPRINT_ADDRESS, IMPRINT_URL, PRIVACY_URL } from "@/lib/constants";
import { getQuestionResponseMapping } from "@/lib/responses";
import { renderEmailResponseValue } from "@/modules/email/emails/lib/utils";
import { getTranslate } from "@/tolgee/server";
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

const fbLogoUrl = FB_LOGO_URL;
const logoLink = "https://formbricks.com?utm_source=email_header&utm_medium=email";

interface FollowUpEmailProps {
  followUp: TSurveyFollowUp;
  logoUrl?: string;
  attachResponseData: boolean;
  survey: TSurvey;
  response: TResponse;
}

export async function FollowUpEmail({
  followUp,
  logoUrl,
  attachResponseData,
  survey,
  response,
}: FollowUpEmailProps): Promise<React.JSX.Element> {
  const { properties } = followUp.action;
  const { body } = properties;

  const questions = attachResponseData ? getQuestionResponseMapping(survey, response) : [];
  const t = await getTranslate();
  const isDefaultLogo = !logoUrl || logoUrl === fbLogoUrl;

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
              <Img alt="Logo" className="mx-auto max-h-[100px] w-60 object-contain" src={logoUrl} />
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

            {questions.length > 0 ? <Hr /> : null}

            {questions.map((question) => {
              if (!question.response) return;
              return (
                <Row key={question.question}>
                  <Column className="w-full">
                    <Text className="mb-2 font-medium">{question.question}</Text>
                    {renderEmailResponseValue(question.response, question.type, t, true)}
                  </Column>
                </Row>
              );
            })}
          </Container>

          <Section className="mt-4 text-center text-sm">
            <Link
              className="m-0 font-normal text-slate-500"
              href="https://formbricks.com/?utm_source=email_header&utm_medium=email"
              target="_blank"
              rel="noopener noreferrer">
              {t("emails.email_template_text_1")}
            </Link>
            {IMPRINT_ADDRESS && (
              <Text className="m-0 font-normal text-slate-500 opacity-50">{IMPRINT_ADDRESS}</Text>
            )}
            <Text className="m-0 font-normal text-slate-500 opacity-50">
              {IMPRINT_URL && (
                <Link href={IMPRINT_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500">
                  {t("emails.imprint")}
                </Link>
              )}
              {IMPRINT_URL && PRIVACY_URL && " • "}
              {PRIVACY_URL && (
                <Link href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500">
                  {t("emails.privacy_policy")}
                </Link>
              )}
            </Text>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
}
