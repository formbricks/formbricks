import { getTranslate } from "@/tolgee/server";
import { Container, Text } from "@react-email/components";
import React from "react";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";

interface InviteAcceptedEmailProps {
  inviterName: string;
  inviteeName: string;
}

export async function InviteAcceptedEmail({
  inviterName,
  inviteeName,
}: InviteAcceptedEmailProps): Promise<React.JSX.Element> {
  const t = await getTranslate();
  return (
    <EmailTemplate t={t}>
      <Container>
        <Text>{t("emails.invite_accepted_email_heading", { inviterName })}</Text>
        <Text>
          {t("emails.invite_accepted_email_text_par1", { inviteeName })} {inviteeName}{" "}
          {t("emails.invite_accepted_email_text_par2")}
        </Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default InviteAcceptedEmail;
