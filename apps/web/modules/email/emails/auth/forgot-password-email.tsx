import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { EmailButton } from "../../components/email-button";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";
import { translateEmailText } from "../../lib/utils";

interface ForgotPasswordEmailProps {
  verifyLink: string;
  locale: string;
}

export function ForgotPasswordEmail({ verifyLink, locale }: ForgotPasswordEmailProps): React.JSX.Element {
  return (
    <EmailTemplate locale={locale}>
      <Container>
        <Heading>{translateEmailText("forgot_password_email_heading", locale)}</Heading>
        <Text>{translateEmailText("forgot_password_email_text", locale)}</Text>
        <EmailButton
          href={verifyLink}
          label={translateEmailText("forgot_password_email_change_password", locale)}
        />
        <Text className="font-bold">
          {translateEmailText("forgot_password_email_link_valid_for_24_hours", locale)}
        </Text>
        <Text className="mb-0">{translateEmailText("forgot_password_email_did_not_request", locale)}</Text>
        <EmailFooter locale={locale} />
      </Container>
    </EmailTemplate>
  );
}

export default ForgotPasswordEmail;
