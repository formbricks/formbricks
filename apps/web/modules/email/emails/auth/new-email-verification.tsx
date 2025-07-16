import { getTranslate } from "@/tolgee/server";
import { Container, Heading, Link, Text } from "@react-email/components";
import React from "react";
import { EmailButton } from "../../components/email-button";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";

interface VerificationEmailProps {
  readonly verifyLink: string;
}

export async function NewEmailVerification({
  verifyLink,
}: VerificationEmailProps): Promise<React.JSX.Element> {
  const t = await getTranslate();
  return (
    <EmailTemplate t={t}>
      <Container>
        <Heading>{t("emails.verification_email_heading")}</Heading>
        <Text className="text-sm">{t("emails.new_email_verification_text")}</Text>
        <Text className="text-sm">{t("emails.verification_security_notice")}</Text>
        <EmailButton href={verifyLink} label={t("emails.verification_email_verify_email")} />
        <Text className="text-sm">{t("emails.verification_email_click_on_this_link")}</Text>
        <Link className="break-all text-sm text-black" href={verifyLink}>
          {verifyLink}
        </Link>
        <Text className="text-sm font-bold">{t("emails.verification_email_link_valid_for_24_hours")}</Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default NewEmailVerification;
