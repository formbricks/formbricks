import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { EmailTemplate } from "../../components/email-template";
import { translateEmailText } from "../../lib/utils";

interface EmailCustomizationPreviewEmailProps {
  userName: string;
  locale: string;
  logoUrl?: string;
}

export function EmailCustomizationPreviewEmail({
  userName,
  locale,
  logoUrl,
}: EmailCustomizationPreviewEmailProps): React.JSX.Element {
  return (
    <EmailTemplate logoUrl={logoUrl} locale={locale}>
      <Container>
        <Heading>
          {translateEmailText("email_customization_preview_email_heading", locale, {
            userName,
          })}
        </Heading>
        <Text>{translateEmailText("email_customization_preview_email_text", locale)}</Text>
      </Container>
    </EmailTemplate>
  );
}

export default EmailCustomizationPreviewEmail;
