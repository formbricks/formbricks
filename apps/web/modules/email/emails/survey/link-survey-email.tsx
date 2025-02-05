import { getTranslate } from "@/tolgee/server";
import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { EmailButton } from "../../components/email-button";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";

interface LinkSurveyEmailProps {
  surveyName: string;
  surveyLink: string;
  logoUrl: string;
}

export async function LinkSurveyEmail({
  surveyName,
  surveyLink,
  logoUrl,
}: LinkSurveyEmailProps): Promise<React.JSX.Element> {
  const t = await getTranslate();
  return (
    <EmailTemplate logoUrl={logoUrl} t={t}>
      <Container>
        <Heading>{t("emails.verification_email_hey")}</Heading>
        <Text>{t("emails.verification_email_thanks")}</Text>
        <Text>{t("emails.verification_email_to_fill_survey")}</Text>
        <EmailButton href={surveyLink} label={t("emails.verification_email_take_survey")} />
        <Text className="text-xs text-slate-400">
          {t("emails.verification_email_survey_name")}: {surveyName}
        </Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default LinkSurveyEmail;
