import { getTranslate } from "@/tolgee/server";
import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { EmailTemplate } from "../../components/email-template";

interface EmbedSurveyPreviewEmailProps {
  html: string;
  environmentId: string;
  logoUrl?: string;
}

export async function EmbedSurveyPreviewEmail({
  html,
  environmentId,
  logoUrl,
}: EmbedSurveyPreviewEmailProps): Promise<React.JSX.Element> {
  const t = await getTranslate();
  return (
    <EmailTemplate logoUrl={logoUrl} t={t}>
      <Container>
        <Heading>{t("emails.embed_survey_preview_email_heading")}</Heading>
        <Text className="text-sm">{t("emails.embed_survey_preview_email_text")}</Text>
        <Text className="text-sm">
          <b>{t("emails.embed_survey_preview_email_didnt_request")}</b>{" "}
          {t("emails.embed_survey_preview_email_fight_spam")}
        </Text>
        <div className="text-sm" dangerouslySetInnerHTML={{ __html: html }} />
        <Text className="text-center text-sm text-slate-700">
          {t("emails.embed_survey_preview_email_environment_id")}: {environmentId}
        </Text>
      </Container>
    </EmailTemplate>
  );
}

export default EmbedSurveyPreviewEmail;
