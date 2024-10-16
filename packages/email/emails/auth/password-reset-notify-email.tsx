import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";

export function PasswordResetNotifyEmail(): React.JSX.Element {
  return (
    <EmailTemplate>
      <Container>
        <Heading>Password changed</Heading>
        <Text>Your password has been changed successfully.</Text>
        <EmailFooter />
      </Container>
    </EmailTemplate>
  );
}

export default PasswordResetNotifyEmail;
