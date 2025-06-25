import { getTranslate } from "@/tolgee/server";
import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";

export async function PasswordResetNotifyEmail(): Promise<React.JSX.Element> {
  const t = await getTranslate();
  return (
    <EmailTemplate t={t}>
      <Container>
        <Heading>{t("emails.password_changed_email_heading")}</Heading>
        <Text>{t("emails.password_changed_email_text")}</Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default PasswordResetNotifyEmail;
