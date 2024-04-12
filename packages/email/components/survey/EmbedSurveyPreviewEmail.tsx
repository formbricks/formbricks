import { Container, Heading, Text } from "@react-email/components";
import React from "react";

interface EmbedSurveyPreviewEmailProps {
  html: string;
}

export const EmbedSurveyPreviewEmail = ({ html }: EmbedSurveyPreviewEmailProps) => {
  return (
    <Container>
      <Heading>Preview Email Embed</Heading>
      <Text>This is how the code snippet looks embedded into an email:</Text>
      <div dangerouslySetInnerHTML={{ __html: html }}></div>
    </Container>
  );
};
