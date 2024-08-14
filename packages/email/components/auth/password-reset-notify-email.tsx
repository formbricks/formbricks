import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { EmailFooter } from "../general/email-footer";

export function PasswordResetNotifyEmail(): React.JSX.Element {
  return (
    <Container>
      <Heading>Password changed</Heading>
      <Text>Your password has been changed successfully.</Text>
      <EmailFooter />
    </Container>
  );
}
