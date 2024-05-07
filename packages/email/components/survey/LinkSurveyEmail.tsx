import { Container, Heading, Text } from "@react-email/components";
import React from "react";

import { EmailButton } from "../general/EmailButton";
import { EmailFooter } from "../general/EmailFooter";

interface LinkSurveyEmailProps {
  surveyData?:
    | {
        name?: string;
        subheading?: string;
      }
    | null
    | undefined;
  getSurveyLink: () => string;
}

export const LinkSurveyEmail = ({ surveyData, getSurveyLink }: LinkSurveyEmailProps) => {
  return (
    <Container>
      <Heading>Hey 👋</Heading>
      <Text>Thanks for validating your email. Here is your Survey.</Text>
      <Text className="font-bold">{surveyData?.name}</Text>
      <Text>{surveyData?.subheading}</Text>
      <EmailButton label="Take survey" href={getSurveyLink()} />
      <EmailFooter />
    </Container>
  );
};
