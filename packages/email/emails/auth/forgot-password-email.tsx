import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { EmailButton } from "../../components/email-button";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";

interface ForgotPasswordEmailProps {
  verifyLink: string;
}

export function ForgotPasswordEmail({ verifyLink }: ForgotPasswordEmailProps): React.JSX.Element {
  return (
    <EmailTemplate>
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
    </EmailTemplate>
  );
}

export default ForgotPasswordEmail;
