import { Container, Heading, Link, Text } from "@react-email/components";
import React from "react";
import { EmailButton } from "../../components/email-button";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";
import { translateEmailText } from "../../lib/utils";

interface VerificationEmailProps {
  verifyLink: string;
  verificationRequestLink: string;
  locale: string;
}

export function VerificationEmail({
  verifyLink,
  verificationRequestLink,
  locale,
}: VerificationEmailProps): React.JSX.Element {
  return (
    <EmailTemplate locale={locale}>
      <Container>
        <Heading>{translateEmailText("verification_email_heading", locale)}</Heading>
        <Text>{translateEmailText("verification_email_text", locale)}</Text>
        <EmailButton
          href={verifyLink}
          label={translateEmailText("verification_email_verify_email", locale)}
        />
        <Text>{translateEmailText("verification_email_click_on_this_link", locale)}</Text>
        <Link className="break-all text-black" href={verifyLink}>
          {verifyLink}
        </Link>
        <Text className="font-bold">
          {translateEmailText("verification_email_link_valid_for_24_hours", locale)}
        </Text>
        <Text>
          {translateEmailText("verification_email_if_expired_request_new_token", locale)}
          <Link className="text-black underline" href={verificationRequestLink}>
            {translateEmailText("verification_email_request_new_verification", locale)}
          </Link>
        </Text>
        <EmailFooter locale={locale} />
      </Container>
    </EmailTemplate>
  );
}

export default VerificationEmail;
