import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { EmailButton } from "../../components/email-button";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";
import { translateEmailText } from "../../lib/utils";

interface LinkSurveyEmailProps {
  surveyName: string;
  surveyLink: string;
  locale: string;
  logoUrl: string;
}

export function LinkSurveyEmail({
  surveyName,
  surveyLink,
  locale,
  logoUrl,
}: LinkSurveyEmailProps): React.JSX.Element {
  return (
    <EmailTemplate logoUrl={logoUrl}>
      <Container>
        <Heading>{translateEmailText("verification_email_hey", locale)}</Heading>
        <Text>{translateEmailText("verification_email_thanks", locale)}</Text>
        <Text>{translateEmailText("verification_email_to_fill_survey", locale)}</Text>
        <EmailButton href={surveyLink} label={translateEmailText("verification_email_take_survey", locale)} />
        <Text className="text-xs text-slate-400">
          {translateEmailText("verification_email_survey_name", locale)}: {surveyName}
        </Text>
        <EmailFooter />
      </Container>
    </EmailTemplate>
  );
}

export default LinkSurveyEmail;
