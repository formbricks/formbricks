import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { EmailButton } from "../general/email-button";
import { EmailFooter } from "../general/email-footer";

interface LinkSurveyEmailProps {
  surveyName: string;
  getSurveyLink: () => string;
}

export function LinkSurveyEmail({ surveyName, getSurveyLink }: LinkSurveyEmailProps): React.JSX.Element {
  return (
    <Container>
      <Heading>Hey 👋</Heading>
      <Text>Thanks for validating your email!</Text>
      <Text>To fill out the survey please click on the button below:</Text>
      <EmailButton href={getSurveyLink()} label="Take survey" />
      <Text className="text-xs text-slate-400">Survey name: {surveyName}</Text>
      <EmailFooter />
    </Container>
  );
}
