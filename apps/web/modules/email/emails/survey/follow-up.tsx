import { renderEmailResponseValue } from "@/modules/email/emails/survey/response-finished-email";
import { getTranslate } from "@/tolgee/server";
import {
  Body,
  Column,
  Container,
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
import { FB_LOGO_URL, IMPRINT_ADDRESS, IMPRINT_URL, PRIVACY_URL } from "@formbricks/lib/constants";
import { getQuestionResponseMapping } from "@formbricks/lib/responses";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";

const fbLogoUrl = FB_LOGO_URL;
const logoLink = "https://formbricks.com?utm_source=email_header&utm_medium=email";

interface FollowUpEmailProps {
  html: string;
  logoUrl?: string;
  attachResponseData: boolean;
  survey: TSurvey;
  response: TResponse;
}

export async function FollowUpEmail({
  html,
  logoUrl,
  attachResponseData,
  survey,
  response,
}: FollowUpEmailProps): Promise<React.JSX.Element> {
  const questions = attachResponseData ? getQuestionResponseMapping(survey, response) : [];
  const t = await getTranslate();
  const isDefaultLogo = !logoUrl || logoUrl === fbLogoUrl;

  return (
    <Html>
      <Tailwind>
        <Body
          className="m-0 h-full w-full justify-center bg-slate-50 p-6 text-center text-base font-medium text-slate-800"
          style={{
            fontFamily: "'Jost', 'Helvetica Neue', 'Segoe UI', 'Helvetica', 'sans-serif'",
          }}>
          <Section>
            {isDefaultLogo ? (
              <Link href={logoLink} target="_blank">
                <Img alt="Logo" className="mx-auto w-80" src={fbLogoUrl} />
              </Link>
            ) : (
              <Img alt="Logo" className="mx-auto max-h-[100px] w-80 object-contain" src={logoUrl} />
            )}
          </Section>
          <Container className="mx-auto my-8 max-w-xl rounded-md bg-white p-4 text-left">
            <div
              dangerouslySetInnerHTML={{
                __html: dompurify.sanitize(html, {
                  ALLOWED_TAGS: ["p", "span", "b", "strong", "i", "em", "a", "br"],
                  ALLOWED_ATTR: ["href", "rel", "dir", "class"],
                  ALLOWED_URI_REGEXP: /^https?:\/\//, // Only allow safe URLs starting with http or https
                  ADD_ATTR: ["target"], // Optional: Allow 'target' attribute for links (e.g., _blank)
                }),
              }}
            />

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
            <Text className="m-0 font-normal text-slate-500">{t("emails.powered_by_formbricks")}</Text>

            {IMPRINT_ADDRESS && (
              <Text className="m-0 font-normal text-slate-500 opacity-50">{IMPRINT_ADDRESS}</Text>
            )}
            <Text className="m-0 font-normal text-slate-500 opacity-50">
              {IMPRINT_URL && (
                <Link href={IMPRINT_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500">
                  {t("emails.imprint")}
                </Link>
              )}
              {IMPRINT_URL && PRIVACY_URL && "•"}
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
