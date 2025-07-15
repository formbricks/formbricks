import { getTranslate } from "@/tolgee/server";
import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { EmailButton } from "../../components/email-button";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";

interface InviteEmailProps {
  inviteeName: string;
  inviterName: string;
  verifyLink: string;
}

export async function InviteEmail({
  inviteeName,
  inviterName,
  verifyLink,
}: InviteEmailProps): Promise<React.JSX.Element> {
  const t = await getTranslate();
  return (
    <EmailTemplate t={t}>
      <Container>
        <Heading>
          {t("emails.invite_email_heading", { inviteeName })} {inviteeName}
        </Heading>
        <Text className="text-sm">
          {t("emails.invite_email_text_par1", { inviterName })} {inviterName}{" "}
          {t("emails.invite_email_text_par2")}
        </Text>
        <EmailButton href={verifyLink} label={t("emails.invite_email_button_label")} />
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default InviteEmail;
