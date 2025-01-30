import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";
import { translateEmailText } from "../../lib/utils";

interface PasswordResetNotifyEmailProps {
  locale: string;
}

export function PasswordResetNotifyEmail({ locale }: PasswordResetNotifyEmailProps): React.JSX.Element {
  return (
    <EmailTemplate locale={locale}>
      <Container>
        <Heading>{translateEmailText("password_changed_email_heading", locale)}</Heading>
        <Text>{translateEmailText("password_changed_email_text", locale)}</Text>
        <EmailFooter locale={locale} />
      </Container>
    </EmailTemplate>
  );
}

export default PasswordResetNotifyEmail;
