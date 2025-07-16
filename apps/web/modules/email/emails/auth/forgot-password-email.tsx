import { getTranslate } from "@/tolgee/server";
import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { EmailButton } from "../../components/email-button";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";

interface ForgotPasswordEmailProps {
  verifyLink: string;
}

export async function ForgotPasswordEmail({
  verifyLink,
}: ForgotPasswordEmailProps): Promise<React.JSX.Element> {
  const t = await getTranslate();
  return (
    <EmailTemplate t={t}>
      <Container>
        <Heading>{t("emails.forgot_password_email_heading")}</Heading>
        <Text className="text-sm">{t("emails.forgot_password_email_text")}</Text>
        <EmailButton href={verifyLink} label={t("emails.forgot_password_email_change_password")} />
        <Text className="text-sm font-bold">{t("emails.forgot_password_email_link_valid_for_24_hours")}</Text>
        <Text className="mb-0 text-sm">{t("emails.forgot_password_email_did_not_request")}</Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default ForgotPasswordEmail;
