import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { EmailButton } from "../general/email-button";
import { EmailFooter } from "../general/email-footer";

interface ForgotPasswordEmailProps {
  verifyLink: string;
}

export function ForgotPasswordEmail({ verifyLink }: ForgotPasswordEmailProps): React.JSX.Element {
  return (
    <Container>
      <Heading>Change password</Heading>
      <Text>
        You have requested a link to change your password. You can do this by clicking the link below:
      </Text>
      <EmailButton href={verifyLink} label="Change password" />
      <Text className="font-bold">The link is valid for 24 hours.</Text>
      <Text className="mb-0">If you didn&apos;t request this, please ignore this email.</Text>
      <EmailFooter />
    </Container>
  );
}
