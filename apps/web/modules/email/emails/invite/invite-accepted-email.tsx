import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { getTranslate } from "@/lingodotdev/server";
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
        <Heading>
          {t("emails.invite_accepted_email_heading", { inviterName })}
        </Heading>
        <Text className="text-sm">
          {t("emails.invite_accepted_email_text", { inviteeName })}
        </Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default InviteAcceptedEmail;
