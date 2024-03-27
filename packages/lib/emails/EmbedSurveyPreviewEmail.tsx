import { Container, Heading, Text } from "@react-email/components";
import React from "react";

interface EmbedSurveyPreviewEmailProps {
  previewElement: JSX.Element;
}

export const EmbedSurveyPreviewEmail = ({ previewElement }: EmbedSurveyPreviewEmailProps) => {
  return (
    <Container>
      <Heading>Preview Email Embed</Heading>
      <Text>This is how the code snippet looks embedded into an email:</Text>
      {previewElement}
    </Container>
  );
};
