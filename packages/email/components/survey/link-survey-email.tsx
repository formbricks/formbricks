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
      <Text>Thanks for validating your email. Here is your Survey.</Text>
      <Text className="font-bold">{surveyName}</Text>
      <EmailButton href={getSurveyLink()} label="Take survey" />
      <EmailFooter />
    </Container>
  );
}
