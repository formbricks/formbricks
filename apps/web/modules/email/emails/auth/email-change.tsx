import { getTranslate } from "@/tolgee/server";
import { Container, Heading, Link, Text } from "@react-email/components";
import React from "react";
import { EmailButton } from "../../components/email-button";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";

interface VerificationEmailProps {
  verifyLink: string;
}

export async function VerificationNewEmail({
  verifyLink,
}: VerificationEmailProps): Promise<React.JSX.Element> {
  const t = await getTranslate();
  return (
    <EmailTemplate t={t}>
      <Container>
        <Heading>{t("emails.verification_email_heading")}</Heading>
        <Text>{t("emails.verification_email_text")}</Text>
        <EmailButton href={verifyLink} label={t("emails.verification_email_verify_email")} />
        <Text>{t("emails.verification_email_click_on_this_link")}</Text>
        <Link className="break-all text-black" href={verifyLink}>
          {verifyLink}
        </Link>
        <Text className="font-bold">{t("emails.verification_email_link_valid_for_24_hours")}</Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default VerificationNewEmail;
