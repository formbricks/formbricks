import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { EmailTemplate } from "../../components/email-template";
import { translateEmailText } from "../../lib/utils";

interface EmbedSurveyPreviewEmailProps {
  html: string;
  environmentId: string;
  locale: string;
  logoUrl?: string;
}

export function EmbedSurveyPreviewEmail({
  html,
  environmentId,
  locale,
  logoUrl,
}: EmbedSurveyPreviewEmailProps): React.JSX.Element {
  return (
    <EmailTemplate logoUrl={logoUrl} locale={locale}>
      <Container>
        <Heading>{translateEmailText("embed_survey_preview_email_heading", locale)}</Heading>
        <Text>{translateEmailText("embed_survey_preview_email_text", locale)}</Text>
        <Text className="text-sm">
          <b>{translateEmailText("embed_survey_preview_email_didnt_request", locale)}</b>{" "}
          {translateEmailText("embed_survey_preview_email_fight_spam", locale)}
        </Text>
        <div dangerouslySetInnerHTML={{ __html: html }} />
        <Text className="text-center text-sm text-slate-700">
          {translateEmailText("embed_survey_preview_email_environment_id", locale)}: {environmentId}
        </Text>
      </Container>
    </EmailTemplate>
  );
}

export default EmbedSurveyPreviewEmail;
