import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { EmailButton } from "../../components/email-button";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";

interface LinkSurveyEmailProps {
  surveyName: string;
  surveyLink: string;
}

export function LinkSurveyEmail({ surveyName, surveyLink }: LinkSurveyEmailProps): React.JSX.Element {
  return (
    <EmailTemplate>
      <Container>
        <Heading>Hey 👋</Heading>
        <Text>Thanks for validating your email!</Text>
        <Text>To fill out the survey please click on the button below:</Text>
        <EmailButton href={surveyLink} label="Take survey" />
        <Text className="text-xs text-slate-400">Survey name: {surveyName}</Text>
        <EmailFooter />
      </Container>
    </EmailTemplate>
  );
}

export default LinkSurveyEmail;
